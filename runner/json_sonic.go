//go:build (darwin && amd64) || (linux && amd64)
// +build darwin,amd64 linux,amd64

package runner

import (
	"io"

	"github.com/bytedance/sonic"
)

func writeJSONFileSonic(f io.Writer, value *interface{}) error {
	res, err := sonic.Marshal(value)
	if err != nil {
		return err
	}

	return writeAll(f, res)
}

func readJSONFileSonic(f io.Reader) (interface{}, error) {
	bs, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}

	var res interface{}
	err = sonic.Unmarshal(bs, &res)
	return res, err
}
