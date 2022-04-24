package jsonutil

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strconv"

	goccy_json "github.com/goccy/go-json"
)

type Marshaler func(interface{}) ([]byte, error)

type StreamEncoder struct {
	buf           *bytes.Buffer
	w             io.Writer
	first         bool
	array         bool
	quotedColumns map[string][]byte
	marshalFn     Marshaler
}

func NewGenericStreamEncoder(w io.Writer, marshalFn Marshaler, array bool) *StreamEncoder {
	return &StreamEncoder{
		buf:           bytes.NewBuffer(nil),
		w:             w,
		first:         true,
		array:         array,
		quotedColumns: map[string][]byte{},
		marshalFn:     marshalFn,
	}
}

var commaNl = []byte(",\n")

func (sw *StreamEncoder) EncodeRow(row interface{}) error {
	if !sw.first {
		_, err := sw.buf.Write(commaNl)
		if err != nil {
			return fmt.Errorf("Failed to write comma: %s", err)
		}
	}

	if sw.first && sw.array {
		err := sw.buf.WriteByte('[')
		if err != nil {
			return err
		}
	}

	sw.first = false

	r, ok := row.(map[string]interface{})
	if !ok {
		// Short-circuit and fallback to marshalFn if this is not a map
		bs, err := sw.marshalFn(row)
		if err != nil {
			return err
		}

		_, err = sw.buf.Write(bs)
		return err
	}

	err := sw.buf.WriteByte('{')
	if err != nil {
		return err
	}

	j := -1
	for col, val := range r {
		j += 1

		// Write a comma before the current key-value
		if j > 0 {
			err = sw.buf.WriteByte(',')
			if err != nil {
				return err
			}
		}

		quoted := sw.quotedColumns[col]
		if quoted == nil {
			quoted = []byte(strconv.QuoteToASCII(col) + ":")
			sw.quotedColumns[col] = quoted
		}
		_, err = sw.buf.Write(quoted)
		if err != nil {
			return err
		}

		bs, err := sw.marshalFn(val)
		if err != nil {
			return err
		}

		_, err = sw.buf.Write(bs)
		if err != nil {
			return err
		}
	}

	return sw.buf.WriteByte('}')
}

func (sw *StreamEncoder) Close() error {
	// Handle case of EncodeRow never called
	if sw.first {
		err := sw.buf.WriteByte('[')
		if err != nil {
			return err
		}
	}
	err := sw.buf.WriteByte(']')

	for sw.buf.Len() > 0 {
		_, err := sw.buf.WriteTo(sw.w)
		if err != nil {
			return err
		}
	}

	return err
}

func EncodeGeneric(out io.Writer, obj interface{}, marshalFn Marshaler) error {
	a, ok := obj.([]interface{})
	// Fall back to normal encoder
	if !ok {
		bs, err := marshalFn(obj)
		if err != nil {
			return err
		}

		for len(bs) > 0 {
			n, err := out.Write(bs)
			if err != nil {
				return err
			}

			bs = bs[n:]
		}
		return nil
	}

	encoder := NewGenericStreamEncoder(out, marshalFn, true)
	for _, row := range a {
		err := encoder.EncodeRow(row)
		if err != nil {
			return err
		}
	}

	return encoder.Close()
}

func EncodeStdlib(out io.Writer, obj interface{}) error {
	return EncodeGeneric(out, obj, json.Marshal)
}

func NewStdlibStreamEncoder(out io.Writer, array bool) *StreamEncoder {
	return NewGenericStreamEncoder(out, json.Marshal, array)
}

func Encode(out io.Writer, obj interface{}) error {
	return EncodeGeneric(out, obj, goccy_json.Marshal)
}

func NewStreamEncoder(out io.Writer, array bool) *StreamEncoder {
	return NewGenericStreamEncoder(out, goccy_json.Marshal, array)
}
