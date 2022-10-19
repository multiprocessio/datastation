package runner

import (
	"encoding/json"
	"io"
	"io/ioutil"
	"os"
	"strings"

	goccy_json "github.com/goccy/go-json"
	"github.com/tidwall/gjson"
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

func WriteJSONFile(file string, value any) error {
	f, err := openTruncate(file)
	if err != nil {
		return err
	}
	defer f.Close()

	r := newBufferedWriter(f)
	defer r.Flush()

	encoder := jsonNewEncoder(r)
	return encoder.Encode(value)
}

func loadJSONArrayFileWithPath(f, path string) (chan map[string]any, error) {
	out := make(chan map[string]any, 1000)

	fd, err := os.Open(f)
	if err != nil {
		return nil, err
	}

	var reader io.Reader = fd
	if path != "" {
		data, err := ioutil.ReadAll(fd)
		if err != nil {
			return nil, err
		}
		value := gjson.GetBytes(data, path)
		reader = strings.NewReader(value.String())
	}

	bs := make([]byte, 1)
	for {
		_, err := reader.Read(bs)
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

		var r io.Reader = reader

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

func loadJSONArrayFile(f string) (chan map[string]any, error) {
	return loadJSONArrayFileWithPath(f, "")
}
