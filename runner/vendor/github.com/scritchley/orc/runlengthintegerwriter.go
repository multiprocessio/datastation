package orc

import (
	"io"
)

const (
	MaxRepeatSize = 127 + MinRepeatSize
	MinDelta      = -128
	MaxDelta      = 127
)

type RunLengthIntegerWriter struct {
	w              io.ByteWriter
	signed         bool
	literals       []int64
	numLiterals    int
	delta          int
	repeat         bool
	tailRunLength  int
	minRepeatSize  int
	maxRepeatSize  int
	minDelta       int
	maxDelta       int
	maxLiteralSize int
}

func NewRunLengthIntegerWriter(w io.ByteWriter, signed bool) *RunLengthIntegerWriter {
	return &RunLengthIntegerWriter{
		w:              w,
		signed:         signed,
		literals:       make([]int64, MaxLiteralSize),
		minRepeatSize:  MinRepeatSize,
		maxRepeatSize:  MaxRepeatSize,
		minDelta:       MinDelta,
		maxDelta:       MaxDelta,
		maxLiteralSize: MaxLiteralSize,
	}
}

func (w *RunLengthIntegerWriter) writeValues() error {
	if w.numLiterals != 0 {
		if w.repeat {
			err := w.w.WriteByte(byte(w.numLiterals - w.minRepeatSize))
			if err != nil {
				return err
			}
			err = w.w.WriteByte(byte(w.delta))
			if err != nil {
				return err
			}
			if w.signed {
				err := writeVslong(w.w, w.literals[0])
				if err != nil {
					return err
				}
			} else {
				err := writeVulong(w.w, w.literals[0])
				if err != nil {
					return err
				}
			}
		} else {
			err := w.w.WriteByte(byte(-w.numLiterals))
			if err != nil {
				return err
			}
			for i := 0; i < w.numLiterals; i++ {
				if w.signed {
					err := writeVslong(w.w, w.literals[i])
					if err != nil {
						return err
					}
				} else {
					err := writeVulong(w.w, w.literals[i])
					if err != nil {
						return err
					}
				}
			}
		}
		w.repeat = false
		w.numLiterals = 0
		w.tailRunLength = 0
	}
	return nil
}

func (w *RunLengthIntegerWriter) Flush() error {
	return w.writeValues()
}

func (w *RunLengthIntegerWriter) WriteInt(value int64) error {
	if w.numLiterals == 0 {
		w.literals[w.numLiterals] = value
		w.numLiterals++
		w.tailRunLength = 1
	} else if w.repeat {
		if value == int64((w.literals[0])+int64(w.delta*w.numLiterals)) {
			w.numLiterals++
			if w.numLiterals == w.maxRepeatSize {
				return w.writeValues()
			}
		} else {
			err := w.writeValues()
			if err != nil {
				return err
			}
			w.literals[w.numLiterals] = value
			w.numLiterals++
			w.tailRunLength = 1
		}
	} else {
		if w.tailRunLength == 1 {
			w.delta = int(value - w.literals[w.numLiterals-1])
			if w.delta < w.minDelta || w.delta > w.maxDelta {
				w.tailRunLength = 1
			} else {
				w.tailRunLength = 2
			}
		} else if value == w.literals[w.numLiterals-1]+int64(w.delta) {
			w.tailRunLength++
		} else {
			w.delta = int(value - w.literals[w.numLiterals-1])
			if w.delta < w.minDelta || w.delta > w.maxDelta {
				w.tailRunLength = 1
			} else {
				w.tailRunLength = 2
			}
		}
		if w.tailRunLength == w.minRepeatSize {
			if w.numLiterals+1 == w.minRepeatSize {
				w.repeat = true
				w.numLiterals++
			} else {
				w.numLiterals -= w.minRepeatSize - 1
				base := w.literals[w.numLiterals]
				err := w.writeValues()
				if err != nil {
					return err
				}
				w.literals[0] = base
				w.repeat = true
				w.numLiterals = w.minRepeatSize
			}
		} else {
			w.literals[w.numLiterals] = value
			w.numLiterals++
			if w.numLiterals == w.maxLiteralSize {
				return w.writeValues()
			}
		}
	}
	return nil
}

func (w *RunLengthIntegerWriter) Close() error {
	return w.Flush()
}
