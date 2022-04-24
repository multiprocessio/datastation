package orc

import (
	"errors"
	"fmt"
	"io"
)

var (
	ErrEOFUnsignedVInt = errors.New("EOF while reading unsigned vint")
	ErrCorrupt         = errors.New("ORC file is corrupt")
)

const (
	// MinRepeatSize is the minimum number of repeated values required to use run length encoding.
	MinRepeatSize = 3
	// MaxShortRepeatLength is the maximum run length used for RLEV2IntShortRepeat sequences.
	MaxShortRepeatLength = 10
	// MaxScope is the maximum number of values that can be buffered before being flushed.
	MaxScope = 512
)

//go:generate stringer -type=RLEEncodingType

// RLEEncodingType is a run length encoding type specified within the Apache
// ORC file documentation: https://orc.apache.org/docs/run-length.html
type RLEEncodingType int

const (
	RLEV2IntShortRepeat RLEEncodingType = 0
	RLEV2IntDirect      RLEEncodingType = 1
	RLEV2IntPatchedBase RLEEncodingType = 2
	RLEV2IntDelta       RLEEncodingType = 3
)

type RunLengthIntegerReaderV2 struct {
	r               io.ByteReader
	signed          bool
	literals        []int64
	isRepeating     bool
	numLiterals     int
	used            int
	skipCorrupt     bool
	currentEncoding RLEEncodingType
	err             error
	nextByte        *byte
	minRepeatSize   int
}

func NewRunLengthIntegerReaderV2(r io.ByteReader, signed bool, skipCorrupt bool) *RunLengthIntegerReaderV2 {
	return &RunLengthIntegerReaderV2{
		r:             r,
		signed:        signed,
		skipCorrupt:   skipCorrupt,
		literals:      make([]int64, MaxScope),
		minRepeatSize: MinRepeatSize,
	}
}

func (r *RunLengthIntegerReaderV2) available() error {
	byt, err := r.ReadByte()
	if err != nil {
		r.err = err
		return err
	}
	r.nextByte = &byt
	return nil
}

func (r *RunLengthIntegerReaderV2) ReadByte() (byte, error) {
	if r.nextByte != nil {
		byt := *r.nextByte
		r.nextByte = nil
		return byt, nil
	}
	return r.r.ReadByte()
}

func (r *RunLengthIntegerReaderV2) Next() bool {
	if r.err != nil {
		return false
	}
	return r.used != r.numLiterals || r.available() == nil
}

func (r *RunLengthIntegerReaderV2) Value() interface{} {
	return r.Int()
}

func (r *RunLengthIntegerReaderV2) Int() int64 {
	var result int64
	if r.used == r.numLiterals {
		r.numLiterals = 0
		r.used = 0
		err := r.readValues(false)
		if err != nil {
			r.err = err
			return 0
		}
	}
	result = r.literals[r.used]
	r.used++
	return result
}

func (r *RunLengthIntegerReaderV2) readValues(ignoreEOF bool) error {
	// read the first 2 bits and determine the encoding type
	r.isRepeating = false
	firstByte, err := r.ReadByte()
	if err != nil {
		return err
	}
	if firstByte < 0 {
		return fmt.Errorf("Read past end of RLE integer from from %v", r)
	}
	r.currentEncoding = RLEEncodingType((uint64(firstByte) >> 6) & 0x03)
	switch r.currentEncoding {
	case RLEV2IntShortRepeat:
		return r.readShortRepeatValues(firstByte)
	case RLEV2IntDirect:
		return r.readDirectValues(firstByte)
	case RLEV2IntPatchedBase:
		return r.readPatchedBaseValues(firstByte)
	case RLEV2IntDelta:
		return r.readDeltaValues(firstByte)
	default:
		return fmt.Errorf("Unknown encoding %v", r.currentEncoding)
	}
}

func (r *RunLengthIntegerReaderV2) readDeltaValues(firstByte byte) error {

	// extract the number of fixed bits
	fb := int((uint64(firstByte) >> 1) & 0x1f)
	if fb != 0 {
		fb = decodeBitWidth(int(fb))
	}

	// extract the blob run length
	l := int((uint64(firstByte) & 0x01) << 8)
	nextByt, err := r.ReadByte()
	if err != nil {
		return err
	}
	// Set the run-length (this is actual run-length - 1)
	l |= int(nextByt)

	// read the first value stored as vint
	var firstVal int64
	if r.signed {
		firstVal, err = readVslong(r)
		if err != nil {
			return err
		}
	} else {
		firstVal, err = readVulong(r)
		if err != nil {
			return err
		}
	}

	// store first value to result buffer
	prevVal := firstVal
	r.literals[r.numLiterals] = firstVal
	r.numLiterals++

	// if fixed bits is 0 then all values have fixed delta
	if fb == 0 {
		// read the fixed delta value stored as vint (deltas can be negative even
		// if all number are positive)
		fd, err := readVslong(r)
		if err != nil {
			return err
		}
		if fd == 0 {
			r.isRepeating = true
			if r.numLiterals != 1 {
				return errors.New("expected numLiterals to equal 1")
			}
			for i := r.numLiterals; i < r.numLiterals+l; i++ {
				r.literals[i] = r.literals[0]
			}
			r.numLiterals += l
		} else {
			// add fixed deltas to adjacent values
			for i := 0; i < l; i++ {
				r.literals[r.numLiterals] = r.literals[r.numLiterals-1] + fd
				r.numLiterals++
			}
		}
	} else {
		deltaBase, err := readVslong(r)
		if err != nil {
			return err
		}
		// add delta base and first value
		r.literals[r.numLiterals] = firstVal + deltaBase
		r.numLiterals++
		prevVal = r.literals[r.numLiterals-1]
		l--

		// write the unpacked values, add it to previous value and store final
		// value to result buffer. if the delta base value is negative then it
		// is a decreasing sequence else an increasing sequence
		err = readInts(r.literals, r.numLiterals, l, fb, r)
		if err != nil {
			return err
		}
		for l > 0 {
			if deltaBase < 0 {
				r.literals[r.numLiterals] = prevVal - r.literals[r.numLiterals]
			} else {
				r.literals[r.numLiterals] = prevVal + r.literals[r.numLiterals]
			}
			prevVal = r.literals[r.numLiterals]
			l--
			r.numLiterals++
		}
	}
	return nil
}

func (r *RunLengthIntegerReaderV2) readShortRepeatValues(firstByte byte) error {

	// read the number of bytes occupied by the value
	size := (uint64(firstByte) >> 3) & 0x07
	// #bytes are one off
	size++

	// read the run length
	l := int(firstByte & 0x07)

	// run lengths values are stored only after MIN_REPEAT value is met
	l += r.minRepeatSize

	val, err := bytesToLongBE(r, int(size))
	if err != nil {
		return err
	}

	if r.signed {
		val = zigzagDecode(uint64(val))
	}

	if r.numLiterals != 0 {
		// Currently this always holds, which makes peekNextAvailLength simpler.
		// If this changes, peekNextAvailLength should be adjusted accordingly.
		return errors.New("readValues called with existing values present")
	}

	// repeat the value for length times
	r.isRepeating = true
	// TODO: this is not so useful and V1 reader doesn't do that. Fix? Same if delta == 0
	for i := 0; i < l; i++ {
		r.literals[i] = val
	}
	r.numLiterals = l

	return nil
}
func (r *RunLengthIntegerReaderV2) readDirectValues(firstByte byte) error {

	// extract the number of fixed bits
	fbo := (uint64(firstByte) >> 1) & 0x1f
	fb := uint64(decodeBitWidth(int(fbo)))

	// extract the run length
	l := int((int64(firstByte) & 0x01) << 8)
	nextByte, err := r.ReadByte()
	if err != nil {
		return err
	}
	l |= int(nextByte)
	// runs are one off
	l++

	// write the unpacked values and zigzag decode to result buffer
	err = readInts(r.literals, r.numLiterals, l, int(fb), r)
	if err != nil {
		return err
	}

	if r.signed {
		for i := 0; i < l; i++ {
			r.literals[r.numLiterals] = zigzagDecode(uint64(r.literals[r.numLiterals]))
			r.numLiterals++
		}
	} else {

		r.numLiterals += l
	}

	return nil
}
func (r *RunLengthIntegerReaderV2) readPatchedBaseValues(firstByte byte) error {
	// extract the number of fixed bits
	fixedBits := decodeBitWidth(int(uint64(firstByte) >> 1 & 0x1f))

	// extract the run length
	length := int(uint64(firstByte&0x01) << 8)
	// read a byte
	b, err := r.ReadByte()
	if err != nil {
		return err
	}
	length |= int(b)
	// runs are one off
	length++
	// extract the number of bytes occupied by base
	thirdByte, err := r.ReadByte()
	if err != nil {
		return err
	}
	baseWidth := uint64(thirdByte) >> 5 & 0x07
	// base width is one off
	baseWidth++
	// extract patch width
	patchWidth := decodeBitWidth(int(thirdByte) & 0x1F)

	// read fourth byte and extract patch gap width
	fourthByte, err := r.ReadByte()
	if err != nil {
		return err
	}
	patchGapWidth := uint64(fourthByte) >> 5 & 0x07
	// patch gap width is one off
	patchGapWidth++
	// extract the length of the patch list
	patchListLength := fourthByte & 0x1F
	// read the next base width number of bytes to extract base value
	base, err := bytesToLongBE(r, int(baseWidth))
	if err != nil {
		return err
	}
	mask := int64(1 << ((baseWidth * 8) - 1))
	// if MSB of base value is 1 then base is negative value else positive
	if (base & mask) != 0 {
		base = base & ^mask
		base = -base
	}

	// unpack the data blob
	unpacked := make([]int64, length)
	err = readInts(unpacked, 0, length, int(fixedBits), r)
	if err != nil {
		return err
	}

	// unpack the patch blob
	unpackedPatch := make([]int64, int(patchListLength))
	if (patchWidth+int(patchGapWidth)) > 64 && !r.skipCorrupt {
		return errors.New(`Corruption in ORC data encountered. To skip` +
			` reading corrupted data, set skipCorrupt to true`)
	}

	bitSize := getClosestFixedBits(patchWidth + int(patchGapWidth))
	err = readInts(unpackedPatch, 0, int(patchListLength), bitSize, r)
	if err != nil && err != io.EOF {
		return err
	}

	var patchIndex int
	var currentGap int64
	var currentPatch int64

	patchMask := int64((1 << uint(patchWidth)) - 1)

	currentGap = int64(uint64(unpackedPatch[patchIndex]) >> uint64(patchWidth))
	currentPatch = unpackedPatch[patchIndex] & patchMask
	var actualGap int64

	// special case: gap is >255 then patch value will be 0.
	// if gap is <=255 then patch value cannot be 0
	for currentGap == 255 && currentPatch == 0 {
		actualGap += 255
		patchIndex++
		currentGap = int64(uint64(unpackedPatch[patchIndex]) >> uint64(patchWidth))
		currentPatch = unpackedPatch[patchIndex] & patchMask
	}
	// add the left over gap
	actualGap += currentGap
	// unpack data blob, patch it (if required), add base to get final result
	for i := 0; i < len(unpacked); i++ {
		if i == int(actualGap) {
			// extract the patch value
			patchedValue := int64(unpacked[i] | (currentPatch << uint64(fixedBits)))

			// add base to patched value
			r.literals[r.numLiterals] = base + patchedValue
			r.numLiterals++

			// increment the patch to point to next entry in patch list
			patchIndex++

			if patchIndex < int(patchListLength) {
				// read the next gap and patch
				currentGap = int64(uint64(unpackedPatch[patchIndex]) >> uint64(patchWidth))
				currentPatch = unpackedPatch[patchIndex] & patchMask
				actualGap = 0
				// special case: gap is >255 then patch will be 0. if gap is
				// <=255 then patch cannot be 0
				for currentGap == 255 && currentPatch == 0 {
					actualGap += 255
					patchIndex++
					currentGap = int64(uint64(unpackedPatch[patchIndex]) >> uint64(patchWidth))
					currentPatch = unpackedPatch[patchIndex] & patchMask
				}
				// add the left over gap
				actualGap += currentGap
				// next gap is relative to the current gap
				actualGap += int64(i)
			}
		} else {
			// no patching required. add base to unpacked value to get final value
			r.literals[r.numLiterals] = base + unpacked[i]
			r.numLiterals++
		}
	}

	return nil
}

func (r *RunLengthIntegerReaderV2) Err() error {
	return r.err
}
