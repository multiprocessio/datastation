package orc

import (
	"io"
)

const (
	BufferSize = 64
)

type fixedBitSize int

const (
	fixedBitSizeOne fixedBitSize = iota
	fixedBitSizeTwo
	fixedBitSizeThree
	fixedBitSizeFour
	fixedBitSizeFive
	fixedBitSizeSix
	fixedBitSizeSeven
	fixedBitSizeEight
	fixedBitSizeNine
	fixedBitSizeTen
	fixedBitSizeEleven
	fixedBitSizeTwelve
	fixedBitSizeThirteen
	fixedBitSizeFourteen
	fixedBitSizeFifteen
	fixedBitSizeSixteen
	fixedBitSizeSeventeen
	fixedBitSizeEighteen
	fixedBitSizeNineteen
	fixedBitSizeTwenty
	fixedBitSizeTwentyOne
	fixedBitSizeTwentyTwo
	fixedBitSizeTwentyThree
	fixedBitSizeTwentyFour
	fixedBitSizeTwentySix
	fixedBitSizeTwentyEight
	fixedBitSizeThirty
	fixedBitSizeThirtyTwo
	fixedBitSizeForty
	fixedBitSizeFortyEight
	fixedBitSizeFiftySix
	fixedBitSizeSixtyFour
)

func decodeBitWidth(n int) int {
	if n >= int(fixedBitSizeOne) && n <= int(fixedBitSizeTwentyFour) {
		return n + 1
	} else if n == int(fixedBitSizeTwentySix) {
		return 26
	} else if n == int(fixedBitSizeTwentyEight) {
		return 28
	} else if n == int(fixedBitSizeThirty) {
		return 30
	} else if n == int(fixedBitSizeThirtyTwo) {
		return 32
	} else if n == int(fixedBitSizeForty) {
		return 40
	} else if n == int(fixedBitSizeFortyEight) {
		return 48
	} else if n == int(fixedBitSizeFiftySix) {
		return 56
	} else {
		return 64
	}
}

func encodeBitWidth(n int) int {
	if n >= 1 && n <= 24 {
		return n - 1
	} else if n > 24 && n <= 26 {
		return int(fixedBitSizeTwentySix)
	} else if n > 26 && n <= 28 {
		return int(fixedBitSizeTwentyEight)
	} else if n > 28 && n <= 30 {
		return int(fixedBitSizeThirty)
	} else if n > 30 && n <= 32 {
		return int(fixedBitSizeThirtyTwo)
	} else if n > 32 && n <= 40 {
		return int(fixedBitSizeForty)
	} else if n > 40 && n <= 48 {
		return int(fixedBitSizeFortyEight)
	} else if n > 48 && n <= 56 {
		return int(fixedBitSizeFiftySix)
	} else {
		return int(fixedBitSizeSixtyFour)
	}
}

func getClosestFixedBits(width int) int {
	if width == 0 {
		return 1
	}
	if width >= 1 && width <= 24 {
		return width
	} else if width > 24 && width <= 26 {
		return 26
	} else if width > 26 && width <= 28 {
		return 28
	} else if width > 28 && width <= 30 {
		return 30
	} else if width > 30 && width <= 32 {
		return 32
	} else if width > 32 && width <= 40 {
		return 40
	} else if width > 40 && width <= 48 {
		return 48
	} else if width > 48 && width <= 56 {
		return 56
	} else {
		return 64
	}
}

func getClosestAlignedFixedBits(n int) int {
	if n == 0 || n == 1 {
		return 1
	} else if n > 1 && n <= 2 {
		return 2
	} else if n > 2 && n <= 4 {
		return 4
	} else if n > 4 && n <= 8 {
		return 8
	} else if n > 8 && n <= 16 {
		return 16
	} else if n > 16 && n <= 24 {
		return 24
	} else if n > 24 && n <= 32 {
		return 32
	} else if n > 32 && n <= 40 {
		return 40
	} else if n > 40 && n <= 48 {
		return 48
	} else if n > 48 && n <= 56 {
		return 56
	} else {
		return 64
	}
}

// readVint reads a variable width integer from ByteReader r.
func readVInt(signed bool, r io.ByteReader) (int64, error) {
	if signed {
		return readSignedVInt(r)
	}
	return readUnsignedVInt(r)
}

// readerSignedVInt reads a signed variable width integer from ByteReader r.
func readSignedVInt(r io.ByteReader) (int64, error) {
	result, err := readUnsignedVInt(r)
	if err != nil {
		return result, err
	}
	return int64((uint64(result) >> uint64(1)) ^ -(uint64(result) & uint64(1))), nil
}

// readerUnsignedVInt reads an unsigned variable width integer from ByteReader r.
func readUnsignedVInt(r io.ByteReader) (int64, error) {
	var result int64
	var offset int
	b := int64(0x80)
	for (b & 0x80) != 0 {
		nb, err := r.ReadByte()
		if err != nil {
			return result, err
		}
		b = int64(nb)
		if b == -1 {
			return result, ErrEOFUnsignedVInt
		}
		result |= (b & 0x7f) << uint64(offset)
		offset += 7
	}
	return result, nil
}

func readBitPackedInts(buffer []int64, offset int, length int, bitSize int, r io.ByteReader) error {
	var bitsLeft int
	var current int
	for i := offset; i < (offset + length); i++ {
		var result int64
		bitsLeftToRead := bitSize
		for bitsLeftToRead > bitsLeft {
			result <<= uint64(bitsLeft)
			result |= int64(current & ((1 << uint64(bitsLeft)) - 1))
			bitsLeftToRead -= bitsLeft
			b, err := r.ReadByte()
			if err != nil {
				return err
			}
			current = int(b)
			bitsLeft = 8
		}
		// handle the left over bits
		if bitsLeftToRead > 0 {
			result <<= uint64(bitsLeftToRead)
			bitsLeft -= bitsLeftToRead
			result |= int64((current >> uint64(bitsLeft)) & ((1 << uint64(bitsLeftToRead)) - 1))
		}
		buffer[i] = result
	}
	return nil
}

func absInt64(a int64) int64 {
	if a > 0 {
		return a
	}
	return -a
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

func minInt64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

func isSafeSubtract(left, right int64) bool {
	return (left^right) >= 0 || (left^(left-right)) >= 0
}

func percentileBits(data []int64, offset int, length int, p float64) int {
	if (p > 1.0) || (p <= 0.0) {
		return -1
	}

	// histogram that store the encoded bit requirement for each values.
	// maximum number of bits that can encoded is 32 (refer fixedBitSizes)
	hist := make([]int, 32, 32)

	// compute the histogram
	for i := offset; i < (offset + length); i++ {
		idx := encodeBitWidth(findClosestNumBits(data[i]))
		hist[idx]++
	}

	perLen := float64(length) * (1.0 - p)

	// return the bits required by pth percentile length
	for i := len(hist) - 1; i >= 0; i-- {
		perLen -= float64(hist[i])
		if perLen < 0 {
			return decodeBitWidth(i)
		}
	}

	return 0

}

func findClosestNumBits(value int64) int {
	var count int
	for value != 0 {
		count++
		value = int64(uint64(value) >> 1)
	}
	return getClosestFixedBits(count)
}

func writeInts(input []int64, offset int, l int, bitSize int, w io.ByteWriter) error {
	if input == nil || len(input) < 1 || offset < 0 || l < 1 || bitSize < 1 {
		return nil
	}

	switch bitSize {
	case 1:
		return unrolledBitPack1(input, offset, l, w)
	case 2:
		return unrolledBitPack2(input, offset, l, w)
	case 4:
		return unrolledBitPack4(input, offset, l, w)
	case 8:
		return unrolledBitPack8(input, offset, l, w)
	case 16:
		return unrolledBitPack16(input, offset, l, w)
	case 24:
		return unrolledBitPack24(input, offset, l, w)
	case 32:
		return unrolledBitPack32(input, offset, l, w)
	case 40:
		return unrolledBitPack40(input, offset, l, w)
	case 48:
		return unrolledBitPack48(input, offset, l, w)
	case 56:
		return unrolledBitPack56(input, offset, l, w)
	case 64:
		return unrolledBitPack64(input, offset, l, w)
	}

	bitsLeft := 8
	current := byte(0x00)
	for i := offset; i < (offset + l); i++ {
		value := input[i]
		bitsToWrite := bitSize
		for bitsToWrite > bitsLeft {
			// add the bits to the bottom of the current word
			current |= uint8(uint64(value) >> uint64(bitsToWrite-bitsLeft))
			// subtract out the bits we just added
			bitsToWrite -= bitsLeft
			// zero out the bits above bitsToWrite
			value &= (1 << uint64(bitsToWrite)) - 1
			err := w.WriteByte(current)
			if err != nil {
				return err
			}
			current = 0
			bitsLeft = 8
		}
		bitsLeft -= bitsToWrite
		current |= uint8(value << uint64(bitsLeft))
		if bitsLeft == 0 {
			err := w.WriteByte(current)
			if err != nil {
				return err
			}
			current = 0
			bitsLeft = 8
		}
	}

	// flush
	if bitsLeft != 8 {
		err := w.WriteByte(current)
		if err != nil {
			return err
		}
		current = 0
		bitsLeft = 8
	}

	return nil
}

func unrolledBitPack1(input []int64, offset int, len int, w io.ByteWriter) error {
	numHops := 8
	remainder := len % numHops
	endOffset := offset + len
	endUnroll := endOffset - remainder
	val := 0
	for i := offset; i < endUnroll; i = i + numHops {
		val = (val | (int(input[i]&1) << 7) |
			(int(input[i+1]&1) << 6) |
			(int(input[i+2]&1) << 5) |
			(int(input[i+3]&1) << 4) |
			(int(input[i+4]&1) << 3) |
			(int(input[i+5]&1) << 2) |
			(int(input[i+6]&1) << 1) |
			int(input[i+7])&1)
		err := w.WriteByte(byte(val))
		if err != nil {
			return err
		}
		val = 0
	}
	if remainder > 0 {
		startShift := 7
		for i := endUnroll; i < endOffset; i++ {
			val = (val | int(input[i]&1)<<uint64(startShift))
			startShift--
		}
		err := w.WriteByte(byte(val))
		if err != nil {
			return err
		}
	}
	return nil
}

func unrolledBitPack2(input []int64, offset int, len int, w io.ByteWriter) error {
	numHops := 4
	remainder := len % numHops
	endOffset := offset + len
	endUnroll := endOffset - remainder
	val := 0
	for i := offset; i < endUnroll; i = i + numHops {
		val = (val | (int(input[i]&3) << 6) |
			(int(input[i+1]&3) << 4) |
			(int(input[i+2]&3) << 2) |
			int(input[i+3])&3)
		err := w.WriteByte(byte(val))
		if err != nil {
			return err
		}
		val = 0
	}

	if remainder > 0 {
		startShift := 6
		for i := endUnroll; i < endOffset; i++ {
			val = (val | int(input[i]&3)<<uint64(startShift))
			startShift -= 2
		}
		err := w.WriteByte(byte(val))
		if err != nil {
			return err
		}
	}
	return nil
}

func unrolledBitPack4(input []int64, offset int, len int, w io.ByteWriter) error {
	numHops := 2
	remainder := len % numHops
	endOffset := offset + len
	endUnroll := endOffset - remainder
	val := 0
	for i := offset; i < endUnroll; i = i + numHops {
		val = (val | (int(input[i]&15) << 4) | int(input[i+1])&15)
		err := w.WriteByte(byte(val))
		if err != nil {
			return err
		}
		val = 0
	}

	if remainder > 0 {
		startShift := 4
		for i := endUnroll; i < endOffset; i++ {
			val = (val | int(input[i]&15)<<uint64(startShift))
			startShift -= 4
		}
		err := w.WriteByte(byte(val))
		if err != nil {
			return err
		}
	}
	return nil
}

func unrolledBitPack8(input []int64, offset int, len int, w io.ByteWriter) error {
	return unrolledBitPackBytes(input, offset, len, w, 1)
}

func unrolledBitPack16(input []int64, offset int, len int, w io.ByteWriter) error {
	return unrolledBitPackBytes(input, offset, len, w, 2)
}

func unrolledBitPack24(input []int64, offset int, len int, w io.ByteWriter) error {
	return unrolledBitPackBytes(input, offset, len, w, 3)
}

func unrolledBitPack32(input []int64, offset int, len int, w io.ByteWriter) error {
	return unrolledBitPackBytes(input, offset, len, w, 4)
}

func unrolledBitPack40(input []int64, offset int, len int, w io.ByteWriter) error {
	return unrolledBitPackBytes(input, offset, len, w, 5)
}

func unrolledBitPack48(input []int64, offset int, len int, w io.ByteWriter) error {
	return unrolledBitPackBytes(input, offset, len, w, 6)
}

func unrolledBitPack56(input []int64, offset int, len int, w io.ByteWriter) error {
	return unrolledBitPackBytes(input, offset, len, w, 7)
}

func unrolledBitPack64(input []int64, offset int, len int, w io.ByteWriter) error {
	return unrolledBitPackBytes(input, offset, len, w, 8)
}

func unrolledBitPackBytes(input []int64, offset int, len int, w io.ByteWriter, numBytes int) error {
	numHops := 8
	remainder := len % numHops
	endOffset := offset + len
	endUnroll := endOffset - remainder
	var i int
	for i = offset; i < endUnroll; i = i + numHops {
		err := writeLongBE(w, input, i, numHops, numBytes)
		if err != nil {
			return err
		}
	}

	if remainder > 0 {
		err := writeRemainingLongs(w, i, input, remainder, numBytes)
		if err != nil {
			return err
		}
	}
	return nil
}

func writeLongBE(w io.ByteWriter, input []int64, offset int, numHops int, numBytes int) error {
	writeBuffer := make([]byte, BufferSize, BufferSize)
	switch numBytes {
	case 1:
		writeBuffer[0] = byte(input[offset+0] & 255)
		writeBuffer[1] = byte(input[offset+1] & 255)
		writeBuffer[2] = byte(input[offset+2] & 255)
		writeBuffer[3] = byte(input[offset+3] & 255)
		writeBuffer[4] = byte(input[offset+4] & 255)
		writeBuffer[5] = byte(input[offset+5] & 255)
		writeBuffer[6] = byte(input[offset+6] & 255)
		writeBuffer[7] = byte(input[offset+7] & 255)
	case 2:
		writeLongBE2(writeBuffer, input[offset+0], 0)
		writeLongBE2(writeBuffer, input[offset+1], 2)
		writeLongBE2(writeBuffer, input[offset+2], 4)
		writeLongBE2(writeBuffer, input[offset+3], 6)
		writeLongBE2(writeBuffer, input[offset+4], 8)
		writeLongBE2(writeBuffer, input[offset+5], 10)
		writeLongBE2(writeBuffer, input[offset+6], 12)
		writeLongBE2(writeBuffer, input[offset+7], 14)
	case 3:
		writeLongBE3(writeBuffer, input[offset+0], 0)
		writeLongBE3(writeBuffer, input[offset+1], 3)
		writeLongBE3(writeBuffer, input[offset+2], 6)
		writeLongBE3(writeBuffer, input[offset+3], 9)
		writeLongBE3(writeBuffer, input[offset+4], 12)
		writeLongBE3(writeBuffer, input[offset+5], 15)
		writeLongBE3(writeBuffer, input[offset+6], 18)
		writeLongBE3(writeBuffer, input[offset+7], 21)
	case 4:
		writeLongBE4(writeBuffer, input[offset+0], 0)
		writeLongBE4(writeBuffer, input[offset+1], 4)
		writeLongBE4(writeBuffer, input[offset+2], 8)
		writeLongBE4(writeBuffer, input[offset+3], 12)
		writeLongBE4(writeBuffer, input[offset+4], 16)
		writeLongBE4(writeBuffer, input[offset+5], 20)
		writeLongBE4(writeBuffer, input[offset+6], 24)
		writeLongBE4(writeBuffer, input[offset+7], 28)
	case 5:
		writeLongBE5(writeBuffer, input[offset+0], 0)
		writeLongBE5(writeBuffer, input[offset+1], 5)
		writeLongBE5(writeBuffer, input[offset+2], 10)
		writeLongBE5(writeBuffer, input[offset+3], 15)
		writeLongBE5(writeBuffer, input[offset+4], 20)
		writeLongBE5(writeBuffer, input[offset+5], 25)
		writeLongBE5(writeBuffer, input[offset+6], 30)
		writeLongBE5(writeBuffer, input[offset+7], 35)
	case 6:
		writeLongBE6(writeBuffer, input[offset+0], 0)
		writeLongBE6(writeBuffer, input[offset+1], 6)
		writeLongBE6(writeBuffer, input[offset+2], 12)
		writeLongBE6(writeBuffer, input[offset+3], 18)
		writeLongBE6(writeBuffer, input[offset+4], 24)
		writeLongBE6(writeBuffer, input[offset+5], 30)
		writeLongBE6(writeBuffer, input[offset+6], 36)
		writeLongBE6(writeBuffer, input[offset+7], 42)
	case 7:
		writeLongBE7(writeBuffer, input[offset+0], 0)
		writeLongBE7(writeBuffer, input[offset+1], 7)
		writeLongBE7(writeBuffer, input[offset+2], 14)
		writeLongBE7(writeBuffer, input[offset+3], 21)
		writeLongBE7(writeBuffer, input[offset+4], 28)
		writeLongBE7(writeBuffer, input[offset+5], 35)
		writeLongBE7(writeBuffer, input[offset+6], 42)
		writeLongBE7(writeBuffer, input[offset+7], 49)
	case 8:
		writeLongBE8(writeBuffer, input[offset+0], 0)
		writeLongBE8(writeBuffer, input[offset+1], 8)
		writeLongBE8(writeBuffer, input[offset+2], 16)
		writeLongBE8(writeBuffer, input[offset+3], 24)
		writeLongBE8(writeBuffer, input[offset+4], 32)
		writeLongBE8(writeBuffer, input[offset+5], 40)
		writeLongBE8(writeBuffer, input[offset+6], 48)
		writeLongBE8(writeBuffer, input[offset+7], 56)
	}

	toWrite := numHops * numBytes
	for j := 0; j < toWrite; j++ {
		err := w.WriteByte(writeBuffer[j])
		if err != nil {
			return err
		}
	}
	return nil
}

func writeLongBE2(writeBuffer []byte, val int64, wbOffset int) {
	writeBuffer[wbOffset+0] = byte(uint64(val) >> 8)
	writeBuffer[wbOffset+1] = byte(uint64(val) >> 0)
}

func writeLongBE3(writeBuffer []byte, val int64, wbOffset int) {
	writeBuffer[wbOffset+0] = byte(uint64(val) >> 16)
	writeBuffer[wbOffset+1] = byte(uint64(val) >> 8)
	writeBuffer[wbOffset+2] = byte(uint64(val) >> 0)
}

func writeLongBE4(writeBuffer []byte, val int64, wbOffset int) {
	writeBuffer[wbOffset+0] = byte(uint64(val) >> 24)
	writeBuffer[wbOffset+1] = byte(uint64(val) >> 16)
	writeBuffer[wbOffset+2] = byte(uint64(val) >> 8)
	writeBuffer[wbOffset+3] = byte(uint64(val) >> 0)
}

func writeLongBE5(writeBuffer []byte, val int64, wbOffset int) {
	writeBuffer[wbOffset+0] = byte(uint64(val) >> 32)
	writeBuffer[wbOffset+1] = byte(uint64(val) >> 24)
	writeBuffer[wbOffset+2] = byte(uint64(val) >> 16)
	writeBuffer[wbOffset+3] = byte(uint64(val) >> 8)
	writeBuffer[wbOffset+4] = byte(uint64(val) >> 0)
}

func writeLongBE6(writeBuffer []byte, val int64, wbOffset int) {
	writeBuffer[wbOffset+0] = byte(uint64(val) >> 40)
	writeBuffer[wbOffset+1] = byte(uint64(val) >> 32)
	writeBuffer[wbOffset+2] = byte(uint64(val) >> 24)
	writeBuffer[wbOffset+3] = byte(uint64(val) >> 16)
	writeBuffer[wbOffset+4] = byte(uint64(val) >> 8)
	writeBuffer[wbOffset+5] = byte(uint64(val) >> 0)
}

func writeLongBE7(writeBuffer []byte, val int64, wbOffset int) {
	writeBuffer[wbOffset+0] = byte(uint64(val) >> 48)
	writeBuffer[wbOffset+1] = byte(uint64(val) >> 40)
	writeBuffer[wbOffset+2] = byte(uint64(val) >> 32)
	writeBuffer[wbOffset+3] = byte(uint64(val) >> 24)
	writeBuffer[wbOffset+4] = byte(uint64(val) >> 16)
	writeBuffer[wbOffset+5] = byte(uint64(val) >> 8)
	writeBuffer[wbOffset+6] = byte(uint64(val) >> 0)
}

func writeLongBE8(writeBuffer []byte, val int64, wbOffset int) {
	writeBuffer[wbOffset+0] = byte(uint64(val) >> 56)
	writeBuffer[wbOffset+1] = byte(uint64(val) >> 48)
	writeBuffer[wbOffset+2] = byte(uint64(val) >> 40)
	writeBuffer[wbOffset+3] = byte(uint64(val) >> 32)
	writeBuffer[wbOffset+4] = byte(uint64(val) >> 24)
	writeBuffer[wbOffset+5] = byte(uint64(val) >> 16)
	writeBuffer[wbOffset+6] = byte(uint64(val) >> 8)
	writeBuffer[wbOffset+7] = byte(uint64(val) >> 0)
}

func writeRemainingLongs(w io.ByteWriter, offset int, input []int64, remainder int, numBytes int) error {
	numHops := remainder
	idx := 0
	writeBuffer := make([]byte, 64, 64)
	switch numBytes {
	case 1:
		for remainder > 0 {
			writeBuffer[idx] = byte(input[offset+idx] & 255)
			remainder--
			idx++
		}
	case 2:
		for remainder > 0 {
			writeLongBE2(writeBuffer, input[offset+idx], idx*2)
			remainder--
			idx++
		}
	case 3:
		for remainder > 0 {
			writeLongBE3(writeBuffer, input[offset+idx], idx*3)
			remainder--
			idx++
		}
	case 4:
		for remainder > 0 {
			writeLongBE4(writeBuffer, input[offset+idx], idx*4)
			remainder--
			idx++
		}

	case 5:
		for remainder > 0 {
			writeLongBE5(writeBuffer, input[offset+idx], idx*5)
			remainder--
			idx++
		}
	case 6:
		for remainder > 0 {
			writeLongBE6(writeBuffer, input[offset+idx], idx*6)
			remainder--
			idx++
		}
	case 7:
		for remainder > 0 {
			writeLongBE7(writeBuffer, input[offset+idx], idx*7)
			remainder--
			idx++
		}
	case 8:
		for remainder > 0 {
			writeLongBE8(writeBuffer, input[offset+idx], idx*8)
			remainder--
			idx++
		}
	}

	toWrite := numHops * numBytes
	for j := 0; j < toWrite; j++ {
		err := w.WriteByte(writeBuffer[j])
		if err != nil {
			return err
		}
	}
	return nil
}

func writeVulong(w io.ByteWriter, value int64) error {
	for {
		if (value & ^0x7f) == 0 {
			err := w.WriteByte(byte(value))
			if err != nil {
				return err
			}
			return nil
		}
		err := w.WriteByte(byte(0x80 | (value & 0x7f)))
		if err != nil {
			return err
		}
		value = int64(uint64(value) >> 7)
	}
}

func writeVslong(w io.ByteWriter, value int64) error {
	return writeVulong(w, (value<<1)^(value>>63))
}

func readVulong(r io.ByteReader) (int64, error) {
	var result int64
	var offset int
	b := int64(0x80)
	for (b & 0x80) != 0 {
		nb, err := r.ReadByte()
		if err != nil {
			return result, err
		}
		b = int64(nb)
		if b == -1 {
			return result, ErrEOFUnsignedVInt
		}
		result |= (b & 0x7f) << uint64(offset)
		offset += 7
	}
	return result, nil
}

func readVslong(r io.ByteReader) (int64, error) {
	result, err := readVulong(r)
	if err != nil {
		return 0, err
	}
	return int64((uint64(result) >> uint64(1)) ^ -(uint64(result) & uint64(1))), nil
}

func readInts(buffer []int64, offset, len, bitSize int, r io.ByteReader) error {
	bitsLeft := 0
	current := 0
	switch bitSize {
	case 1:
		return unrolledUnPack1(buffer, offset, len, r)
	case 2:
		return unrolledUnPack2(buffer, offset, len, r)
	case 4:
		return unrolledUnPack4(buffer, offset, len, r)
	case 8:
		return unrolledUnPack8(buffer, offset, len, r)
	case 16:
		return unrolledUnPack16(buffer, offset, len, r)
	case 24:
		return unrolledUnPack24(buffer, offset, len, r)
	case 32:
		return unrolledUnPack32(buffer, offset, len, r)
	case 40:
		return unrolledUnPack40(buffer, offset, len, r)
	case 48:
		return unrolledUnPack48(buffer, offset, len, r)
	case 56:
		return unrolledUnPack56(buffer, offset, len, r)
	case 64:
		return unrolledUnPack64(buffer, offset, len, r)
	}

	for i := offset; i < (offset + len); i++ {
		var result int64
		bitsLeftToRead := bitSize
		for bitsLeftToRead > bitsLeft {
			result <<= uint64(bitsLeft)
			result |= int64(current & ((1 << uint64(bitsLeft)) - 1))
			bitsLeftToRead -= bitsLeft
			byt, err := r.ReadByte()
			if err != nil {
				return err
			}
			current = int(byt)
			bitsLeft = 8
		}
		// handle the left over bits
		if bitsLeftToRead > 0 {
			result <<= uint64(bitsLeftToRead)
			bitsLeft -= bitsLeftToRead
			result |= int64((current >> uint64(bitsLeft)) & ((1 << uint64(bitsLeftToRead)) - 1))
		}
		buffer[i] = result
	}

	return nil
}

func unrolledUnPack1(buffer []int64, offset, len int, r io.ByteReader) error {
	numHops := 8
	remainder := len % numHops
	endOffset := offset + len
	endUnroll := endOffset - remainder
	var val uint64
	for i := offset; i < endUnroll; i = i + numHops {
		byt, err := r.ReadByte()
		if err != nil {
			return err
		}
		val = uint64(byt)
		buffer[i] = int64((val >> 7) & 1)
		buffer[i+1] = int64((val >> 6) & 1)
		buffer[i+2] = int64((val >> 5) & 1)
		buffer[i+3] = int64((val >> 4) & 1)
		buffer[i+4] = int64((val >> 3) & 1)
		buffer[i+5] = int64((val >> 2) & 1)
		buffer[i+6] = int64((val >> 1) & 1)
		buffer[i+7] = int64(val & 1)
	}

	if remainder > 0 {
		startShift := 7
		byt, err := r.ReadByte()
		if err != nil {
			return err
		}
		val = uint64(byt)
		for i := endUnroll; i < endOffset; i++ {
			buffer[i] = int64((val >> uint64(startShift)) & 1)
			startShift--
		}
	}
	return nil
}

func unrolledUnPack2(buffer []int64, offset, len int, r io.ByteReader) error {
	numHops := 4
	remainder := len % numHops
	endOffset := offset + len
	endUnroll := endOffset - remainder
	var val uint64
	for i := offset; i < endUnroll; i = i + numHops {
		byt, err := r.ReadByte()
		if err != nil {
			return err
		}
		val = uint64(byt)
		buffer[i] = int64((val >> 6) & 3)
		buffer[i+1] = int64((val >> 4) & 3)
		buffer[i+2] = int64((val >> 2) & 3)
		buffer[i+3] = int64(val & 3)
	}

	if remainder > 0 {
		startShift := 6
		byt, err := r.ReadByte()
		if err != nil {
			return err
		}
		val = uint64(byt)
		for i := endUnroll; i < endOffset; i++ {
			buffer[i] = int64((val >> uint64(startShift)) & 3)
			startShift -= 2
		}
	}
	return nil
}

func unrolledUnPack4(buffer []int64, offset, len int, r io.ByteReader) error {
	numHops := 2
	remainder := len % numHops
	endOffset := offset + len
	endUnroll := endOffset - remainder
	var val uint64
	for i := offset; i < endUnroll; i = i + numHops {
		byt, err := r.ReadByte()
		if err != nil {
			return err
		}
		val = uint64(byt)
		buffer[i] = int64((val >> 4) & 15)
		buffer[i+1] = int64(val & 15)
	}

	if remainder > 0 {
		startShift := 4
		byt, err := r.ReadByte()
		if err != nil {
			return err
		}
		val = uint64(byt)
		for i := endUnroll; i < endOffset; i++ {
			buffer[i] = int64((val >> uint64(startShift)) & 15)
			startShift -= 4
		}
	}
	return nil
}

func unrolledUnPack8(buffer []int64, offset, len int, r io.ByteReader) error {
	return unrolledUnPackBytes(buffer, offset, len, r, 1)
}

func unrolledUnPack16(buffer []int64, offset, len int, r io.ByteReader) error {
	return unrolledUnPackBytes(buffer, offset, len, r, 2)
}

func unrolledUnPack24(buffer []int64, offset, len int, r io.ByteReader) error {
	return unrolledUnPackBytes(buffer, offset, len, r, 3)
}

func unrolledUnPack32(buffer []int64, offset, len int, r io.ByteReader) error {
	return unrolledUnPackBytes(buffer, offset, len, r, 4)
}

func unrolledUnPack40(buffer []int64, offset, len int, r io.ByteReader) error {
	return unrolledUnPackBytes(buffer, offset, len, r, 5)
}

func unrolledUnPack48(buffer []int64, offset, len int, r io.ByteReader) error {
	return unrolledUnPackBytes(buffer, offset, len, r, 6)
}

func unrolledUnPack56(buffer []int64, offset, len int, r io.ByteReader) error {
	return unrolledUnPackBytes(buffer, offset, len, r, 7)
}

func unrolledUnPack64(buffer []int64, offset, len int, r io.ByteReader) error {
	return unrolledUnPackBytes(buffer, offset, len, r, 8)
}

func unrolledUnPackBytes(buffer []int64, offset, len int, r io.ByteReader, numBytes int) error {
	numHops := 8
	remainder := len % numHops
	endOffset := offset + len
	endUnroll := endOffset - remainder
	i := offset
	for ; i < endUnroll; i = i + numHops {
		err := readLongBE(r, buffer, i, numHops, numBytes)
		if err != nil {
			return err
		}
	}
	if remainder > 0 {
		err := readRemainingLongs(buffer, i, r, remainder, numBytes)
		if err != nil {
			return err
		}
	}
	return nil
}

func readLongBE(r io.ByteReader, buffer []int64, start, numHops, numBytes int) error {
	toRead := numHops * numBytes
	readBuffer := make([]byte, BufferSize, BufferSize)
	for i := 0; i < toRead; i++ {
		byt, err := r.ReadByte()
		if err != nil {
			return err
		}
		readBuffer[i] = byt
	}

	switch numBytes {
	case 1:
		buffer[start+0] = int64(readBuffer[0] & 255)
		buffer[start+1] = int64(readBuffer[1] & 255)
		buffer[start+2] = int64(readBuffer[2] & 255)
		buffer[start+3] = int64(readBuffer[3] & 255)
		buffer[start+4] = int64(readBuffer[4] & 255)
		buffer[start+5] = int64(readBuffer[5] & 255)
		buffer[start+6] = int64(readBuffer[6] & 255)
		buffer[start+7] = int64(readBuffer[7] & 255)
	case 2:
		buffer[start+0] = readLongBE2(readBuffer, 0)
		buffer[start+1] = readLongBE2(readBuffer, 2)
		buffer[start+2] = readLongBE2(readBuffer, 4)
		buffer[start+3] = readLongBE2(readBuffer, 6)
		buffer[start+4] = readLongBE2(readBuffer, 8)
		buffer[start+5] = readLongBE2(readBuffer, 10)
		buffer[start+6] = readLongBE2(readBuffer, 12)
		buffer[start+7] = readLongBE2(readBuffer, 14)
	case 3:
		buffer[start+0] = readLongBE3(readBuffer, 0)
		buffer[start+1] = readLongBE3(readBuffer, 3)
		buffer[start+2] = readLongBE3(readBuffer, 6)
		buffer[start+3] = readLongBE3(readBuffer, 9)
		buffer[start+4] = readLongBE3(readBuffer, 12)
		buffer[start+5] = readLongBE3(readBuffer, 15)
		buffer[start+6] = readLongBE3(readBuffer, 18)
		buffer[start+7] = readLongBE3(readBuffer, 21)
	case 4:
		buffer[start+0] = readLongBE4(readBuffer, 0)
		buffer[start+1] = readLongBE4(readBuffer, 4)
		buffer[start+2] = readLongBE4(readBuffer, 8)
		buffer[start+3] = readLongBE4(readBuffer, 12)
		buffer[start+4] = readLongBE4(readBuffer, 16)
		buffer[start+5] = readLongBE4(readBuffer, 20)
		buffer[start+6] = readLongBE4(readBuffer, 24)
		buffer[start+7] = readLongBE4(readBuffer, 28)
	case 5:
		buffer[start+0] = readLongBE5(readBuffer, 0)
		buffer[start+1] = readLongBE5(readBuffer, 5)
		buffer[start+2] = readLongBE5(readBuffer, 10)
		buffer[start+3] = readLongBE5(readBuffer, 15)
		buffer[start+4] = readLongBE5(readBuffer, 20)
		buffer[start+5] = readLongBE5(readBuffer, 25)
		buffer[start+6] = readLongBE5(readBuffer, 30)
		buffer[start+7] = readLongBE5(readBuffer, 35)
	case 6:
		buffer[start+0] = readLongBE6(readBuffer, 0)
		buffer[start+1] = readLongBE6(readBuffer, 6)
		buffer[start+2] = readLongBE6(readBuffer, 12)
		buffer[start+3] = readLongBE6(readBuffer, 18)
		buffer[start+4] = readLongBE6(readBuffer, 24)
		buffer[start+5] = readLongBE6(readBuffer, 30)
		buffer[start+6] = readLongBE6(readBuffer, 36)
		buffer[start+7] = readLongBE6(readBuffer, 42)
	case 7:
		buffer[start+0] = readLongBE7(readBuffer, 0)
		buffer[start+1] = readLongBE7(readBuffer, 7)
		buffer[start+2] = readLongBE7(readBuffer, 14)
		buffer[start+3] = readLongBE7(readBuffer, 21)
		buffer[start+4] = readLongBE7(readBuffer, 28)
		buffer[start+5] = readLongBE7(readBuffer, 35)
		buffer[start+6] = readLongBE7(readBuffer, 42)
		buffer[start+7] = readLongBE7(readBuffer, 49)
	case 8:
		buffer[start+0] = readLongBE8(readBuffer, 0)
		buffer[start+1] = readLongBE8(readBuffer, 8)
		buffer[start+2] = readLongBE8(readBuffer, 16)
		buffer[start+3] = readLongBE8(readBuffer, 24)
		buffer[start+4] = readLongBE8(readBuffer, 32)
		buffer[start+5] = readLongBE8(readBuffer, 40)
		buffer[start+6] = readLongBE8(readBuffer, 48)
		buffer[start+7] = readLongBE8(readBuffer, 56)
	}
	return nil
}

func readLongBE2(readBuffer []byte, rbOffset int) int64 {
	return ((int64(readBuffer[rbOffset]&255) << 8) +
		(int64(readBuffer[rbOffset+1]&255) << 0))
}

func readLongBE3(readBuffer []byte, rbOffset int) int64 {
	return ((int64(readBuffer[rbOffset]&255) << 16) +
		(int64(readBuffer[rbOffset+1]&255) << 8) +
		(int64(readBuffer[rbOffset+2]&255) << 0))
}

func readLongBE4(readBuffer []byte, rbOffset int) int64 {
	return ((int64(readBuffer[rbOffset]&255) << 24) +
		(int64(readBuffer[rbOffset+1]&255) << 16) +
		(int64(readBuffer[rbOffset+2]&255) << 8) +
		(int64(readBuffer[rbOffset+3]&255) << 0))
}

func readLongBE5(readBuffer []byte, rbOffset int) int64 {
	return ((int64(readBuffer[rbOffset]&255) << 32) +
		(int64(readBuffer[rbOffset+1]&255) << 24) +
		(int64(readBuffer[rbOffset+2]&255) << 16) +
		(int64(readBuffer[rbOffset+3]&255) << 8) +
		(int64(readBuffer[rbOffset+4]&255) << 0))
}

func readLongBE6(readBuffer []byte, rbOffset int) int64 {
	return ((int64(readBuffer[rbOffset]&255) << 40) +
		(int64(readBuffer[rbOffset+1]&255) << 32) +
		(int64(readBuffer[rbOffset+2]&255) << 24) +
		(int64(readBuffer[rbOffset+3]&255) << 16) +
		(int64(readBuffer[rbOffset+4]&255) << 8) +
		(int64(readBuffer[rbOffset+5]&255) << 0))
}

func readLongBE7(readBuffer []byte, rbOffset int) int64 {
	return ((int64(readBuffer[rbOffset]&255) << 48) +
		(int64(readBuffer[rbOffset+1]&255) << 40) +
		(int64(readBuffer[rbOffset+2]&255) << 32) +
		(int64(readBuffer[rbOffset+3]&255) << 24) +
		(int64(readBuffer[rbOffset+4]&255) << 16) +
		(int64(readBuffer[rbOffset+5]&255) << 8) +
		(int64(readBuffer[rbOffset+6]&255) << 0))
}

func readLongBE8(readBuffer []byte, rbOffset int) int64 {
	return ((int64(readBuffer[rbOffset]&255) << 56) +
		(int64(readBuffer[rbOffset+1]&255) << 48) +
		(int64(readBuffer[rbOffset+2]&255) << 40) +
		(int64(readBuffer[rbOffset+3]&255) << 32) +
		(int64(readBuffer[rbOffset+4]&255) << 24) +
		(int64(readBuffer[rbOffset+5]&255) << 16) +
		(int64(readBuffer[rbOffset+6]&255) << 8) +
		(int64(readBuffer[rbOffset+7]&255) << 0))
}

func readRemainingLongs(buffer []int64, offset int, r io.ByteReader, remainder int, numBytes int) error {
	toRead := remainder * numBytes

	// bulk read to buffer
	readBuffer := make([]byte, BufferSize, BufferSize)
	for i := 0; i < toRead; i++ {
		byt, err := r.ReadByte()
		if err != nil {
			return err
		}
		readBuffer[i] = byt
	}

	idx := 0
	switch numBytes {
	case 1:
		for remainder > 0 {
			buffer[offset] = int64(readBuffer[idx] & 255)
			offset++
			remainder--
			idx++
		}
	case 2:
		for remainder > 0 {
			buffer[offset] = readLongBE2(readBuffer, idx*2)
			offset++
			remainder--
			idx++
		}
	case 3:
		for remainder > 0 {
			buffer[offset] = readLongBE3(readBuffer, idx*3)
			offset++
			remainder--
			idx++
		}
	case 4:
		for remainder > 0 {
			buffer[offset] = readLongBE4(readBuffer, idx*4)
			offset++
			remainder--
			idx++
		}
	case 5:
		for remainder > 0 {
			buffer[offset] = readLongBE5(readBuffer, idx*5)
			offset++
			remainder--
			idx++
		}
	case 6:
		for remainder > 0 {
			buffer[offset] = readLongBE6(readBuffer, idx*6)
			offset++
			remainder--
			idx++
		}
	case 7:
		for remainder > 0 {
			buffer[offset] = readLongBE7(readBuffer, idx*7)
			offset++
			remainder--
			idx++
		}
	case 8:
		for remainder > 0 {
			buffer[offset] = readLongBE8(readBuffer, idx*8)
			offset++
			remainder--
			idx++
		}
	}
	return nil
}

func bytesToLongBE(r io.ByteReader, n int) (int64, error) {
	var out int64
	var val int64
	for n > 0 {
		n--
		byt, err := r.ReadByte()
		if err != nil {
			return 0, err
		}
		val = int64(byt)
		out |= val << uint64(n*8)
	}
	return out, nil
}

// zigzagEncode encodes a signed integer using zig-zag encoding returning
// an unsigned integer.
func zigzagEncode(i int64) uint64 {
	return uint64((uint64(i) << 1) ^ uint64((int64(i) >> 63)))
}

// zigzagDecode decodes an unsigned zig-zag encoded integer into a signed
// integer.
func zigzagDecode(i uint64) int64 {
	return int64((i >> 1) ^ uint64((int64(i&1)<<63)>>63))
}

func formatNanos(nanos int64) int64 {
	if nanos == 0 {
		return 0
	} else if nanos%100 != 0 {
		return nanos << 3
	} else {
		nanos /= 100
		trailingZeros := int64(1)
		for nanos%10 == 0 && trailingZeros < 7 {
			nanos /= 10
			trailingZeros++
		}
		return nanos<<3 | trailingZeros
	}
}
