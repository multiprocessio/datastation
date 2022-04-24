package orc

import (
	"io"
)

type BooleanWriter struct {
	*RunLengthByteWriter
	bitsInData int
	data       byte
}

func NewBooleanWriter(w io.ByteWriter) *BooleanWriter {
	return &BooleanWriter{
		RunLengthByteWriter: NewRunLengthByteWriter(w),
	}
}

func (b *BooleanWriter) WriteBool(t bool) error {
	// If bitsInData is equal to 8 then write the byte
	// to the underlying ByteStreamWriter.
	if b.bitsInData >= 8 {
		err := b.flushBools()
		if err != nil {
			return err
		}
	}
	if t {
		// If true, toggle the bit at relevant position.
		b.data |= (1 << uint(7-b.bitsInData))
	}
	b.bitsInData++
	return nil
}

func (b *BooleanWriter) flushBools() error {
	if b.bitsInData > 0 {
		err := b.RunLengthByteWriter.WriteByte(b.data)
		if err != nil {
			return err
		}
		b.bitsInData = 0
		b.data = 0
	}
	return nil
}

func (b *BooleanWriter) Flush() error {
	err := b.flushBools()
	if err != nil {
		return err
	}
	return b.RunLengthByteWriter.Flush()
}

func (b *BooleanWriter) Close() error {
	err := b.Flush()
	if err != nil {
		return err
	}
	return b.RunLengthByteWriter.Close()
}
