package orc

import (
	"io"
)

const (
	MaxLiteralSize = 128
)

type RunLengthByteWriter struct {
	io.ByteWriter
	literals       []byte
	numLiterals    int
	repeat         bool
	tailRunLength  int
	minRepeatSize  int
	maxLiteralSize int
	maxRepeatSize  int
}

func NewRunLengthByteWriter(w io.ByteWriter) *RunLengthByteWriter {
	return &RunLengthByteWriter{
		ByteWriter:     w,
		literals:       make([]byte, MaxLiteralSize),
		minRepeatSize:  MinRepeatSize,
		maxLiteralSize: MaxLiteralSize,
		maxRepeatSize:  127 + MinRepeatSize,
	}
}

func (b *RunLengthByteWriter) writeValues() error {
	if b.numLiterals != 0 {
		if b.repeat {
			err := b.ByteWriter.WriteByte(byte(b.numLiterals - b.minRepeatSize))
			if err != nil {
				return err
			}
			err = b.ByteWriter.WriteByte(b.literals[0])
			if err != nil {
				return err
			}
		} else {
			err := b.ByteWriter.WriteByte(byte(-b.numLiterals))
			if err != nil {
				return err
			}
			for i := 0; i < b.numLiterals; i++ {
				err = b.ByteWriter.WriteByte(b.literals[i])
				if err != nil {
					return err
				}
			}
		}
		b.repeat = false
		b.tailRunLength = 0
		b.numLiterals = 0
	}
	return nil
}

func (b *RunLengthByteWriter) Flush() error {
	return b.writeValues()
}

func (b *RunLengthByteWriter) WriteByte(value byte) error {
	if b.numLiterals == 0 {
		b.literals[b.numLiterals] = value
		b.numLiterals++
		b.tailRunLength = 1
	} else if b.repeat {
		if value == b.literals[0] {
			b.numLiterals++
			if b.numLiterals == b.maxRepeatSize {
				return b.writeValues()
			}
		} else {
			err := b.writeValues()
			if err != nil {
				return err
			}
			b.literals[b.numLiterals] = value
			b.numLiterals++
			b.tailRunLength = 1
		}
	} else {
		if value == b.literals[b.numLiterals-1] {
			b.tailRunLength++
		} else {
			b.tailRunLength = 1
		}
		if b.tailRunLength == b.minRepeatSize {
			if b.numLiterals+1 == b.minRepeatSize {
				b.repeat = true
				b.numLiterals++
			} else {
				b.numLiterals -= b.minRepeatSize - 1
				err := b.writeValues()
				if err != nil {
					return err
				}
				b.literals[0] = value
				b.repeat = true
				b.numLiterals = b.minRepeatSize
			}
		} else {
			b.literals[b.numLiterals] = value
			b.numLiterals++
			if b.numLiterals == b.maxLiteralSize {
				return b.writeValues()
			}
		}
	}
	return nil
}

func (b *RunLengthByteWriter) Close() error {
	return b.Flush()
}
