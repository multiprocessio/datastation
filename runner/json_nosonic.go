// +build !linux !darwin
// +build !amd64

package runner

func writeJSONFileSonic(f io.Writer, value interface{}) error {
	panic("Sonic is not available, this case shouldn't be possible to hit on this OS/ARCH.")
}
