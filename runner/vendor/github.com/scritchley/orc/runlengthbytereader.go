package orc

import "io"

// RunLengthByteReader reads a byte run length encoded stream from ByteReader r.
type RunLengthByteReader struct {
	r             io.ByteReader
	literals      []byte
	nextByte      *byte
	numLiterals   int
	used          int
	repeat        bool
	minRepeatSize int
	err           error
}

func NewRunLengthByteReader(r io.ByteReader) *RunLengthByteReader {
	return &RunLengthByteReader{
		r:             r,
		literals:      make([]byte, MaxLiteralSize),
		minRepeatSize: MinRepeatSize,
	}
}

func (b *RunLengthByteReader) available() error {
	byt, err := b.ReadByte()
	if err != nil {
		b.err = err
		return err
	}
	b.nextByte = &byt
	return nil
}

func (b *RunLengthByteReader) ReadByte() (byte, error) {
	if b.nextByte != nil {
		byt := *b.nextByte
		b.nextByte = nil
		return byt, nil
	}
	return b.r.ReadByte()
}

func (b *RunLengthByteReader) Next() bool {
	return b.used != b.numLiterals || b.available() == nil
}

func (b *RunLengthByteReader) Byte() byte {
	var result byte
	if b.used == b.numLiterals {
		err := b.readValues()
		if err != nil {
			return 0
		}
	}
	if b.repeat {
		result = b.literals[0]
	} else {
		result = b.literals[b.used]
	}
	b.used++
	return result
}

func (b *RunLengthByteReader) readValues() error {
	control, err := b.ReadByte()
	if err != nil {
		return err
	}
	b.used = 0
	if control < 0x80 {
		b.repeat = true
		b.numLiterals = int(control) + b.minRepeatSize
		val, err := b.ReadByte()
		if err != nil {
			return err
		}
		b.literals[0] = val
	} else {
		b.repeat = false
		b.numLiterals = 0x100 - int(control)
		for i := 0; i < b.numLiterals; i++ {
			result, err := b.ReadByte()
			if err != nil {
				return err
			}
			b.literals[i] = result
		}
	}
	return nil
}

func (b *RunLengthByteReader) Value() interface{} {
	return int8(b.Byte())
}

func (b *RunLengthByteReader) Err() error {
	return b.err
}
