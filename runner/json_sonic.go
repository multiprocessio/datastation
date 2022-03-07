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
