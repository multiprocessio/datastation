package orc

import (
	"fmt"
	"io"
	"math"
)

type RunLengthIntegerWriterV2 struct {
	w                    io.ByteWriter
	signed               bool
	alignedBitpacking    bool
	numLiterals          int
	literals             []int64
	encoding             RLEEncodingType
	prevDelta            int64
	fixedDelta           int64
	zzBits90p            int
	zzBits100p           int
	brBits95p            int
	brBits100p           int
	bitsDeltaMax         int
	patchGapWidth        int
	patchLength          int
	patchWidth           int
	gapVsPatchList       []int64
	isFixedDelta         bool
	variableRunLength    int
	fixedRunLength       int
	zigzagLiterals       []int64
	baseRedLiterals      []int64
	adjDeltas            []int64
	min                  int64
	minRepeatSize        int
	maxScope             int
	maxShortRepeatLength int
}

func NewRunLengthIntegerWriterV2(w io.ByteWriter, signed bool) *RunLengthIntegerWriterV2 {
	i := &RunLengthIntegerWriterV2{
		w:                    w,
		signed:               signed,
		literals:             make([]int64, MaxScope, MaxScope),
		zigzagLiterals:       make([]int64, MaxScope, MaxScope),
		baseRedLiterals:      make([]int64, MaxScope, MaxScope),
		adjDeltas:            make([]int64, MaxScope, MaxScope),
		alignedBitpacking:    true,
		minRepeatSize:        MinRepeatSize,
		maxScope:             MaxScope,
		maxShortRepeatLength: MaxShortRepeatLength,
	}
	i.clear()
	return i
}

func (i *RunLengthIntegerWriterV2) Flush() error {
	if i.numLiterals != 0 {
		if i.variableRunLength != 0 {
			err := i.determineEncoding()
			if err != nil {
				return err
			}
			return i.writeValues()
		} else if i.fixedRunLength != 0 {
			if i.fixedRunLength < i.minRepeatSize {
				i.variableRunLength = i.fixedRunLength
				i.fixedRunLength = 0
				err := i.determineEncoding()
				if err != nil {
					return err
				}
				return i.writeValues()
			} else if i.fixedRunLength >= i.minRepeatSize &&
				i.fixedRunLength <= i.maxShortRepeatLength {
				i.encoding = RLEV2IntShortRepeat
				return i.writeValues()
			} else {
				i.encoding = RLEV2IntDelta
				i.isFixedDelta = true
				return i.writeValues()
			}
		}
	}
	return nil
}

func (i *RunLengthIntegerWriterV2) WriteInt(val int64) error {
	if i.numLiterals == 0 {
		i.initializeLiterals(val)
	} else {
		if i.numLiterals == 1 {
			i.prevDelta = val - i.literals[0]
			i.literals[i.numLiterals] = val
			i.numLiterals++
			// if both values are same count as fixed run else variable run
			if val == i.literals[0] {
				i.fixedRunLength = 2
				i.variableRunLength = 0
			} else {
				i.fixedRunLength = 0
				i.variableRunLength = 2
			}
		} else {
			currentDelta := val - i.literals[i.numLiterals-1]
			if i.prevDelta == 0 && currentDelta == 0 {
				// fixed delta run
				i.literals[i.numLiterals] = val
				i.numLiterals++

				// if variable run is non-zero then we are seeing repeating
				// values at the end of variable run in which case keep
				// updating variable and fixed runs
				if i.variableRunLength > 0 {
					i.fixedRunLength = 2
				}
				i.fixedRunLength += 1

				// if fixed run met the minimum condition and if variable
				// run is non-zero then flush the variable run and shift the
				// tail fixed runs to start of the buffer
				if i.fixedRunLength >= i.minRepeatSize && i.variableRunLength > 0 {
					i.numLiterals -= i.minRepeatSize
					i.variableRunLength -= i.minRepeatSize - 1
					// copy the tail fixed runs
					tailVals := make([]int64, i.minRepeatSize)
					copy(tailVals, i.literals[i.numLiterals:i.numLiterals+i.minRepeatSize])
					// determine variable encoding and flush values
					err := i.determineEncoding()
					if err != nil {
						return err
					}
					err = i.writeValues()
					if err != nil {
						return err
					}
					// shift tail fixed runs to beginning of the buffer
					for _, l := range tailVals {
						i.literals[i.numLiterals] = l
						i.numLiterals++
					}
				}

				// if fixed runs reached max repeat length then write values
				if i.fixedRunLength == i.maxScope {
					err := i.determineEncoding()
					if err != nil {
						return err
					}
					err = i.writeValues()
					if err != nil {
						return err
					}
				}
			} else {
				// variable delta run

				// if fixed run length is non-zero and if it satisfies the
				// short repeat conditions then write the values as short repeats
				// else use delta encoding
				if i.fixedRunLength >= i.minRepeatSize {
					if i.fixedRunLength <= i.maxShortRepeatLength {
						i.encoding = RLEV2IntShortRepeat
						err := i.writeValues()
						if err != nil {
							return err
						}
					} else {
						i.encoding = RLEV2IntDelta
						i.isFixedDelta = true
						err := i.writeValues()
						if err != nil {
							return err
						}
					}
				}

				// if fixed run length is <MIN_REPEAT and current value is
				// different from previous then treat it as variable run
				if i.fixedRunLength > 0 && i.fixedRunLength < i.minRepeatSize {
					if val != i.literals[i.numLiterals-1] {
						i.variableRunLength = i.fixedRunLength
						i.fixedRunLength = 0
					}
				}

				// after writing values re-initialize the variables
				if i.numLiterals == 0 {
					i.initializeLiterals(val)
				} else {
					// keep updating variable run lengths
					i.prevDelta = val - i.literals[i.numLiterals-1]
					i.literals[i.numLiterals] = val
					i.numLiterals++
					i.variableRunLength++

					// if variable run length reach the max scope, write it
					if i.variableRunLength == i.maxScope {
						err := i.determineEncoding()
						if err != nil {
							return err
						}
						err = i.writeValues()
						if err != nil {
							return err
						}
					}
				}
			}
		}
	}
	return nil
}

func (i *RunLengthIntegerWriterV2) writeValues() error {
	if i.numLiterals != 0 {
		switch i.encoding {
		case RLEV2IntShortRepeat:
			err := i.writeShortRepeatValues()
			if err != nil {
				return err
			}
		case RLEV2IntDirect:
			err := i.writeDirectValues()
			if err != nil {
				return err
			}
		case RLEV2IntPatchedBase:
			err := i.writePatchedBaseValues()
			if err != nil {
				return err
			}
		default:
			err := i.writeDeltaValues()
			if err != nil {
				return err
			}
		}
		i.clear()
	}
	return nil
}

func (i *RunLengthIntegerWriterV2) Close() error {
	return i.Flush()
}

func (i *RunLengthIntegerWriterV2) clear() {
	i.numLiterals = 0
	i.encoding = RLEV2IntDirect
	i.prevDelta = 0
	i.fixedDelta = 0
	i.zzBits90p = 0
	i.zzBits100p = 0
	i.brBits95p = 0
	i.brBits100p = 0
	i.bitsDeltaMax = 0
	i.patchGapWidth = 0
	i.patchLength = 0
	i.patchWidth = 0
	i.gapVsPatchList = []int64{}
	i.min = 0
	i.isFixedDelta = true
}

func (i *RunLengthIntegerWriterV2) determineEncoding() error {

	// we need to compute zigzag values for DIRECT encoding if we decide to
	// break early for delta overflows or for shorter runs
	i.computeZigZagLiterals()

	i.zzBits100p = percentileBits(i.zigzagLiterals, 0, i.numLiterals, 1.0)

	// not a big win for shorter runs to determine encoding
	if i.numLiterals <= i.minRepeatSize {
		i.encoding = RLEV2IntDirect
		return nil
	}

	// Delta encoding check

	// for identifying monotonic sequences
	isIncreasing := true
	isDecreasing := true
	i.isFixedDelta = true

	i.min = i.literals[0]
	max := i.literals[0]
	initialDelta := i.literals[1] - i.literals[0]
	currDelta := initialDelta
	deltaMax := initialDelta
	i.adjDeltas[0] = initialDelta

	for j := 1; j < i.numLiterals; j++ {
		l1 := i.literals[j]
		l0 := i.literals[j-1]
		currDelta = l1 - l0
		i.min = minInt64(i.min, l1)
		max = maxInt64(max, l1)

		isIncreasing = isIncreasing && (l0 <= l1)
		isDecreasing = isDecreasing && (l0 >= l1)

		i.isFixedDelta = i.isFixedDelta && (currDelta == initialDelta)
		if j > 1 {
			i.adjDeltas[j-1] = absInt64(currDelta)
			deltaMax = maxInt64(deltaMax, i.adjDeltas[j-1])
		}
	}

	// its faster to exit under delta overflow condition without checking for
	// PATCHED_BASE condition as encoding using DIRECT is faster and has less
	// overhead than PATCHED_BASE
	if !isSafeSubtract(max, i.min) {
		i.encoding = RLEV2IntDirect
		return nil
	}

	// invariant - subtracting any number from any other in the literals after
	// this point won't overflow

	// if min is equal to max then the delta is 0, this condition happens for
	// fixed values run >10 which cannot be encoded with SHORT_REPEAT
	if i.min == max {
		if !i.isFixedDelta {
			return fmt.Errorf("%v == %v, isFixedDelta cannot be false", i.min, max)
		}
		if currDelta != 0 {
			return fmt.Errorf("%v == %v, currDelta should be zero", i.min, max)
		}
		i.fixedDelta = 0
		i.encoding = RLEV2IntDelta
		return nil
	}

	if i.isFixedDelta {
		if currDelta != initialDelta {
			return fmt.Errorf("currDelta should be equal to initialDelta for fixed delta encoding")
		}
		i.encoding = RLEV2IntDelta
		i.fixedDelta = currDelta
		return nil
	}

	// if initialDelta is 0 then we cannot delta encode as we cannot identify
	// the sign of deltas (increasing or decreasing)
	if initialDelta != 0 {
		// stores the number of bits required for packing delta blob in
		// delta encoding
		i.bitsDeltaMax = findClosestNumBits(deltaMax)

		// monotonic condition
		if isIncreasing || isDecreasing {
			i.encoding = RLEV2IntDelta
			return nil
		}
	}

	// PATCHED_BASE encoding check

	// percentile values are computed for the zigzag encoded values. if the
	// number of bit requirement between 90th and 100th percentile varies
	// beyond a threshold then we need to patch the values. if the variation
	// is not significant then we can use direct encoding
	i.zzBits90p = percentileBits(i.zigzagLiterals, 0, i.numLiterals, 0.9)
	diffBitsLH := i.zzBits100p - i.zzBits90p

	// if the difference between 90th percentile and 100th percentile fixed
	// bits is > 1 then we need patch the values
	if diffBitsLH > 1 {

		// patching is done only on base reduced values.
		// remove base from literals
		for j := 0; j < i.numLiterals; j++ {
			i.baseRedLiterals[j] = i.literals[j] - i.min
		}

		// 95th percentile width is used to determine max allowed value
		// after which patching will be done
		i.brBits95p = percentileBits(i.baseRedLiterals, 0, i.numLiterals, 0.95)

		// 100th percentile is used to compute the max patch width
		i.brBits100p = percentileBits(i.baseRedLiterals, 0, i.numLiterals, 1.0)

		// after base reducing the values, if the difference in bits between
		// 95th percentile and 100th percentile value is zero then there
		// is no point in patching the values, in which case we will
		// fallback to DIRECT encoding.
		// The decision to use patched base was based on zigzag values, but the
		// actual patching is done on base reduced literals.
		if (i.brBits100p - i.brBits95p) != 0 {
			i.encoding = RLEV2IntPatchedBase
			i.preparePatchedBlob()
			return nil
		}
		i.encoding = RLEV2IntDirect
		return nil
	}
	// if difference in bits between 95th percentile and 100th percentile is
	// 0, then patch length will become 0. Hence we will fallback to direct
	i.encoding = RLEV2IntDirect
	return nil
}

func (i *RunLengthIntegerWriterV2) computeZigZagLiterals() {
	// populate zigzag encoded literals
	for j := 0; j < i.numLiterals; j++ {
		if i.signed {
			i.zigzagLiterals[j] = int64(zigzagEncode(i.literals[j]))
		} else {
			i.zigzagLiterals[j] = i.literals[j]
		}
	}
}

func (i *RunLengthIntegerWriterV2) preparePatchedBlob() {

	// mask will be max value beyond which patch will be generated
	mask := (int64(1) << uint64(i.brBits95p)) - 1

	// since we are considering only 95 percentile, the size of gap and
	// patch array can contain only be 5% values
	i.patchLength = int(math.Ceil(float64(i.numLiterals) * 0.05))

	var gapList []int
	var patchList []int64

	// #bit for patch
	i.patchWidth = i.brBits100p - i.brBits95p
	i.patchWidth = getClosestFixedBits(i.patchWidth)

	// if patch bit requirement is 64 then it will not possible to pack
	// gap and patch together in a long. To make sure gap and patch can be
	// packed together adjust the patch width
	if i.patchWidth == 64 {
		i.patchWidth = 56
		i.brBits95p = 8
		mask = (1 << uint64(i.brBits95p)) - 1
	}

	prev := 0
	gap := 0
	maxGap := 0

	for j := 0; j < i.numLiterals; j++ {
		// if value is above mask then create the patch and record the gap
		if i.baseRedLiterals[j] > mask {
			gap = j - prev
			if gap > maxGap {
				maxGap = gap
			}

			// gaps are relative, so store the previous patched value index
			prev = j
			gapList = append(gapList, gap)

			// extract the most significant bits that are over mask bits
			patch := int64(uint64(i.baseRedLiterals[j]) >> uint64(i.brBits95p))
			patchList = append(patchList, patch)

			// strip off the MSB to enable safe bit packing
			i.baseRedLiterals[j] &= int64(mask)
		}
	}

	// adjust the patch length to number of entries in gap list
	i.patchLength = len(gapList)

	// if the element to be patched is the first and only element then
	// max gap will be 0, but to store the gap as 0 we need atleast 1 bit
	if maxGap == 0 && i.patchLength != 0 {
		i.patchGapWidth = 1
	} else {
		i.patchGapWidth = findClosestNumBits(int64(maxGap))
	}

	// special case: if the patch gap width is greater than 256, then
	// we need 9 bits to encode the gap width. But we only have 3 bits in
	// header to record the gap width. To deal with this case, we will save
	// two entries in patch list in the following way
	// 256 gap width => 0 for patch value
	// actual gap - 256 => actual patch value
	// We will do the same for gap width = 511. If the element to be patched is
	// the last element in the scope then gap width will be 511. In this case we
	// will have 3 entries in the patch list in the following way
	// 255 gap width => 0 for patch value
	// 255 gap width => 0 for patch value
	// 1 gap width => actual patch value
	if i.patchGapWidth > 8 {
		i.patchGapWidth = 8
		// for gap = 511, we need two additional entries in patch list
		if maxGap == 511 {
			i.patchLength += 2
		} else {
			i.patchLength++
		}
	}

	// create gap vs patch list
	gapIdx := 0
	patchIdx := 0
	i.gapVsPatchList = make([]int64, i.patchLength, i.patchLength)
	for j := 0; j < i.patchLength; j++ {
		g := gapList[gapIdx]
		gapIdx++
		p := patchList[patchIdx]
		patchIdx++
		for g > 255 {
			i.gapVsPatchList[j] = (255 << uint64(i.patchWidth))
			j++
			g -= 255
		}

		// store patch value in LSBs and gap in MSBs
		i.gapVsPatchList[j] = int64(g<<uint64(i.patchWidth)) | int64(p)
	}

}

func (i *RunLengthIntegerWriterV2) initializeLiterals(val int64) {
	i.literals[i.numLiterals] = val
	i.numLiterals++
	i.fixedRunLength = 1
	i.variableRunLength = 1
}

func (i *RunLengthIntegerWriterV2) writeShortRepeatValues() error {
	var repeatVal int64
	if i.signed {
		repeatVal = int64(zigzagEncode(i.literals[0]))
	} else {
		repeatVal = i.literals[0]
	}
	numBitsRepeatVal := findClosestNumBits(repeatVal)
	var numBytesRepeatVal int
	if numBitsRepeatVal%8 == 0 {
		numBytesRepeatVal = int(uint64(numBitsRepeatVal) >> 3)
	} else {
		numBytesRepeatVal = int(uint64(numBitsRepeatVal)>>3) + 1
	}

	header := i.getOpCode()
	header |= (numBytesRepeatVal - 1) << 3

	i.fixedRunLength -= i.minRepeatSize

	header |= i.fixedRunLength

	err := i.w.WriteByte(uint8(header))
	if err != nil {
		return err
	}

	for j := numBytesRepeatVal - 1; j >= 0; j-- {
		b := uint8((uint64(repeatVal) >> uint64(j*8)) & 0xff)
		err := i.w.WriteByte(b)
		if err != nil {
			return err
		}
	}

	i.fixedRunLength = 0

	return nil
}

func (i *RunLengthIntegerWriterV2) getOpCode() int {
	return int(i.encoding << 6)
}

func (i *RunLengthIntegerWriterV2) writeDirectValues() error {

	fb := i.zzBits100p

	if i.alignedBitpacking {
		fb = getClosestAlignedFixedBits(fb)
	}

	efb := encodeBitWidth(fb) << 1

	i.variableRunLength--

	tailBits := int(uint64(i.variableRunLength&0x100) >> 8)

	headerFirstByte := i.getOpCode() | efb | tailBits

	headerSecondByte := i.variableRunLength & 0xff

	err := i.w.WriteByte(uint8(headerFirstByte))
	if err != nil {
		return err
	}

	err = i.w.WriteByte(uint8(headerSecondByte))
	if err != nil {
		return err
	}

	err = writeInts(i.zigzagLiterals, 0, i.numLiterals, fb, i.w)
	if err != nil {
		return err
	}

	i.variableRunLength = 0

	return nil

}

func (i *RunLengthIntegerWriterV2) writePatchedBaseValues() error {

	// NOTE: Aligned bit packing cannot be applied for PATCHED_BASE encoding
	// because patch is applied to MSB bits. For example: If fixed bit width of
	// base value is 7 bits and if patch is 3 bits, the actual value is
	// constructed by shifting the patch to left by 7 positions.
	// actual_value = patch << 7 | base_value
	// So, if we align base_value then actual_value can not be reconstructed.

	fb := i.brBits95p
	efb := encodeBitWidth(fb) << 1

	i.variableRunLength--

	tailBits := int(uint64(i.variableRunLength&0x100) >> 8)

	headerFirstByte := i.getOpCode() | efb | tailBits

	headerSecondByte := i.variableRunLength & 0xff

	var isNegative bool
	if i.min < 0 {
		isNegative = true
	}
	if isNegative {
		i.min = -i.min
	}

	baseWidth := findClosestNumBits(i.min) + 1
	var baseBytes int
	if baseWidth%8 == 0 {
		baseBytes = baseWidth / 8
	} else {
		baseBytes = (baseWidth / 8) + 1
	}
	bb := (baseBytes - 1) << 5

	if isNegative {
		i.min |= (1 << uint64((baseBytes*8)-1))
	}

	headerThirdByte := bb | encodeBitWidth(i.patchWidth)

	headerFourthByte := (i.patchGapWidth-1)<<5 | i.patchLength

	err := i.w.WriteByte(uint8(headerFirstByte))
	if err != nil {
		return err
	}

	err = i.w.WriteByte(uint8(headerSecondByte))
	if err != nil {
		return err
	}

	err = i.w.WriteByte(uint8(headerThirdByte))
	if err != nil {
		return err
	}

	err = i.w.WriteByte(uint8(headerFourthByte))
	if err != nil {
		return err
	}

	for j := baseBytes - 1; j >= 0; j-- {
		b := byte((uint64(i.min) >> uint64(j*8)) & 0xff)
		err = i.w.WriteByte(b)
		if err != nil {
			return err
		}
	}

	closestFixedBits := getClosestFixedBits(fb)

	err = writeInts(i.baseRedLiterals, 0, i.numLiterals, closestFixedBits, i.w)
	if err != nil {
		return err
	}

	closestFixedBits = getClosestFixedBits(i.patchGapWidth + i.patchWidth)

	err = writeInts(i.gapVsPatchList, 0, len(i.gapVsPatchList), closestFixedBits, i.w)
	if err != nil {
		return err
	}

	i.variableRunLength = 0

	return nil
}

func (i *RunLengthIntegerWriterV2) writeDeltaValues() error {

	len := 0
	fb := i.bitsDeltaMax
	efb := 0

	if i.alignedBitpacking {
		fb = getClosestAlignedFixedBits(fb)
	}

	if i.isFixedDelta {
		// if fixed run length is greater than threshold then it will be fixed
		// delta sequence with delta value 0 else fixed delta sequence with
		// non-zero delta value
		if i.fixedRunLength > MinRepeatSize {
			// ex. sequence: 2 2 2 2 2 2 2 2
			len = i.fixedRunLength - 1
			i.fixedRunLength = 0
		} else {
			// ex. sequence: 4 6 8 10 12 14 16
			len = i.variableRunLength - 1
			i.variableRunLength = 0
		}
	} else {
		// fixed width 0 is used for long repeating values.
		// sequences that require only 1 bit to encode will have an additional bit
		if fb == 1 {
			fb = 2
		}
		efb = encodeBitWidth(fb)
		efb <<= 1
		len = i.variableRunLength - 1
		i.variableRunLength = 0
	}

	tailBits := int((len & 0x100) >> 8)

	headerFirstByte := i.getOpCode() | efb | tailBits

	headerSecondByte := len & 0xff

	err := i.w.WriteByte(uint8(headerFirstByte))
	if err != nil {
		return err
	}

	err = i.w.WriteByte(uint8(headerSecondByte))
	if err != nil {
		return err
	}

	if i.signed {
		err := writeVslong(i.w, i.literals[0])
		if err != nil {
			return err
		}
	} else {
		err := writeVulong(i.w, i.literals[0])
		if err != nil {
			return err
		}
	}

	if i.isFixedDelta {
		// if delta is fixed then we don't need to store delta blob
		err := writeVslong(i.w, i.fixedDelta)
		if err != nil {
			return err
		}
	} else {
		// store the first value as delta value using zigzag encoding
		err := writeVslong(i.w, i.adjDeltas[0])
		if err != nil {
			return err
		}
		// adjacent delta values are bit packed. The length of adjDeltas array is
		// always one less than the number of literals (delta difference for n
		// elements is n-1). We have already written one element, write the
		// remaining numLiterals - 2 elements here
		err = writeInts(i.adjDeltas, 1, i.numLiterals-2, fb, i.w)
		if err != nil {
			return err
		}
	}

	return nil

}
