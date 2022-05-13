package runner

import (
	"encoding/json"
	"io"
	"os"

	jsonutil "github.com/multiprocessio/go-json"

	goccy_json "github.com/goccy/go-json"
)

// goccy/go-json is the fastest library benchmarked in
// github.com/multiprocessio/go-json-benchmarks that is
// cross-platform and doesn't require an entire string in
// memory (i.e. github.com/bytedance/sonic). But it also
// panics a lot. See github.com/goccy/go-json/issues
// So we wrap it.
func jsonMarshal(o any) (bs []byte, err error) {
	defer func() {
		rerr := recover()
		if rerr != nil {
			Logln("Panic in goccy/go-json encoder, falling back to standard library: %s", err)
		}

		bs, err = json.Marshal(o)
	}()

	return goccy_json.Marshal(o)
}

func jsonUnmarshal(bs []byte, i any) (err error) {
	defer func() {
		rerr := recover()
		if rerr != nil {
			Logln("Panic in goccy/go-json decoder, falling back to standard library: %s", err)
		}

		err = json.Unmarshal(bs, i)
	}()

	return goccy_json.Unmarshal(bs, i)
}

var jsonNewEncoder = goccy_json.NewEncoder
var jsonNewDecoder = goccy_json.NewDecoder

type JSONStreamEncoder jsonutil.StreamEncoder

func withJSONOutWriter(w io.Writer, first, last string, cb func() error) error {
	_, err := w.Write([]byte(first))
	if err != nil {
		return edsef("Failed to write JSON start marker: %s", err)
	}

	err = cb()
	if err != nil {
		return err
	}

	_, err = w.Write([]byte(last))
	if err != nil {
		return edsef("Failed to write JSON end marker: %s", err)
	}

	return nil
}

func withJSONArrayOutWriter(w io.Writer, cb func(w *jsonutil.StreamEncoder) error) error {
	encoder := jsonutil.NewGenericStreamEncoder(w, jsonMarshal, true)
	err := cb(encoder)
	if err != nil {
		return err
	}

	return encoder.Close()
}

func withJSONArrayOutWriterFile(out io.Writer, cb func(w *jsonutil.StreamEncoder) error) error {
	return withJSONArrayOutWriter(out, cb)
}

func readJSONFileInto(file string, into any) error {
	f, err := os.Open(file)
	if err != nil {
		return err
	}
	defer f.Close()

	decoder := goccy_json.NewDecoder(f)
	err = decoder.Decode(into)
	if err == io.EOF {
		return edsef("File is empty")
	}

	return err
}

func writeAll(w io.Writer, bs []byte) error {
	for len(bs) > 0 {
		n, err := w.Write(bs)
		if err != nil {
			return err
		}

		bs = bs[n:]
	}

	return nil
}

func WriteJSONFile(file string, value any) error {
	f, closeFile, err := openTruncateBufio(file)
	if err != nil {
		return err
	}
	defer closeFile()
	defer f.Flush()

	encoder := jsonNewEncoder(f)
	return encoder.Encode(value)
}

func loadJSONArrayFile(f string) (chan map[string]any, error) {
	out := make(chan map[string]any, 1000)

	fd, err := os.Open(f)
	if err != nil {
		return nil, err
	}

	bs := make([]byte, 1)
	for {
		_, err := fd.Read(bs)
		if err != nil {
			return nil, err
		}

		if bs[0] == '[' {
			break
		}
	}

	go func() {
		defer fd.Close()
		defer close(out)

		var r io.Reader = fd

		// Stream all JSON objects
		for {
			// Needs to be recreated each time because of buffered data
			dec := jsonNewDecoder(r)

			var obj map[string]any
			err := dec.Decode(&obj)
			if err == io.EOF {
				return
			}
			if err != nil {
				panic(err)
			}

			out <- obj

			// Line up all buffered bytes into a new reader
			r = io.MultiReader(dec.Buffered(), r)

			// Read comma and array end marker
			for {
				_, err := r.Read(bs)
				if err != nil {
					panic(err)
				}

				if bs[0] == ',' {
					break
				}

				// Done processing
				if bs[0] == ']' {
					return
				}
			}
		}
	}()

	return out, nil
}
