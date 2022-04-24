package orc

import (
	"io"
)

type RunLengthIntegerReader struct {
	r             io.ByteReader
	signed        bool
	literals      []int64
	numLiterals   int
	delta         int
	used          int
	repeat        bool
	minRepeatSize int
	err           error
	nextByte      *byte
}

func NewRunLengthIntegerReader(r io.ByteReader, signed bool) *RunLengthIntegerReader {
	return &RunLengthIntegerReader{
		r:             r,
		signed:        signed,
		literals:      make([]int64, MaxLiteralSize),
		minRepeatSize: MinRepeatSize,
	}
}

func (r *RunLengthIntegerReader) readValues() error {
	control, err := r.ReadByte()
	if err != nil {
		return err
	}
	if control < 0x80 {
		r.numLiterals = int(control) + r.minRepeatSize
		r.used = 0
		r.repeat = true
		delta, err := r.ReadByte()
		if err != nil {
			return err
		}
		r.delta = int(int8(delta))
		if r.signed {
			r.literals[0], err = readVslong(r)
			if err != nil {
				return err
			}
		} else {
			r.literals[0], err = readVulong(r)
			if err != nil {
				return err
			}
		}
	} else {
		r.repeat = false
		r.numLiterals = 0x100 - int(control)
		r.used = 0
		for i := 0; i < r.numLiterals; i++ {
			if r.signed {
				r.literals[i], err = readVslong(r)
				if err != nil {
					return err
				}
			} else {
				r.literals[i], err = readVulong(r)
				if err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func (r *RunLengthIntegerReader) available() error {
	byt, err := r.ReadByte()
	if err != nil {
		r.err = err
		return err
	}
	r.nextByte = &byt
	return nil
}

func (r *RunLengthIntegerReader) ReadByte() (byte, error) {
	if r.nextByte != nil {
		byt := *r.nextByte
		r.nextByte = nil
		return byt, nil
	}
	return r.r.ReadByte()
}

func (r *RunLengthIntegerReader) Next() bool {
	return r.used != r.numLiterals || r.available() == nil
}

func (r *RunLengthIntegerReader) Int() int64 {
	var result int64
	if r.used == r.numLiterals {
		err := r.readValues()
		if err != nil {
			return 0
		}
	}
	if r.repeat {
		result = r.literals[0] + int64(r.used*r.delta)
		r.used++
	} else {
		result = r.literals[r.used]
		r.used++
	}
	return result
}

func (r *RunLengthIntegerReader) Value() interface{} {
	return r.Int()
}

func (r *RunLengthIntegerReader) Err() error {
	return r.err
}
