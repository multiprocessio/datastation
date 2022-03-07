//go:build (!linux && !amd64) || (!darwin && !amd64)
// +build !linux,!amd64 !darwin,!amd64

package runner

import "io"

func writeJSONFileSonic(f io.Writer, value interface{}) error {
	panic("Sonic is not available, this case shouldn't be possible to hit on this OS/ARCH.")
}

func readJSONFileSonic(f io.Reader) (interface{}, error) {
	panic("Sonic is not available, this case shouldn't be possible to hit on this OS/ARCH.")
}
