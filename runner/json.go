package runner

import (
	"io"
	"os"
	"path/filepath"
	"runtime"

	"github.com/multiprocessio/go-json"

	goccy_json "github.com/goccy/go-json"
)

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
	encoder := jsonutil.NewStreamEncoder(w, goccy_json.Marshal, true)
	err := cb(encoder)
	if err != nil {
		return err
	}

	return encoder.Close()
}

func openTruncate(out string) (*os.File, error) {
	base := filepath.Dir(out)
	_ = os.Mkdir(base, os.ModePerm)
	return os.OpenFile(out, os.O_TRUNC|os.O_WRONLY|os.O_CREATE, os.ModePerm)
}

func withJSONArrayOutWriterFile(out io.Writer, cb func(w *jsonutil.StreamEncoder) error) error {
	return withJSONArrayOutWriter(out, cb)
}

func readJSONFileInto(file string, into interface{}) error {
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

const linuxOrMacAMD64 = (runtime.GOOS == "darwin" || runtime.GOOS == "linux") && runtime.GOARCH == "amd64"

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

func WriteJSONFile(file string, value interface{}) error {
	f, err := openTruncate(file)
	if err != nil {
		return err
	}
	defer f.Close()

	if linuxOrMacAMD64 {
		return writeJSONFileSonic(f, &value)
	}

	encoder := goccy_json.NewEncoder(f)
	return encoder.Encode(value)
}

func loadJSONArrayFile(f string) (chan map[string]interface{}, error) {
	fd, err := os.Open(f)
	if err != nil {
		return nil, err
	}

	out := make(chan map[string]interface{}, 1000)

	// This doesn't seem to be faster at the moment
	if linuxOrMacAMD64 {
		res, err := readJSONFileSonic(fd)
		if err != nil {
			return nil, err
		}

		a, ok := res.([]interface{})
		if !ok {
			return nil, edsef("%s is not an array", f)
		}

		go func() {
			defer close(out)
			for _, row := range a {
				rowM := row.(map[string]interface{})
				out <- rowM
			}
		}()

		return out, nil
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
		defer close(out)

		var r io.Reader = fd

		// Stream all JSON objects
		for {
			// Needs to be recreated each time because of buffered data
			dec := goccy_json.NewDecoder(r)

			var obj map[string]interface{}
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
