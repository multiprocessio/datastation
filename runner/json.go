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
