package orc

import (
	"os"
)

// Version is the version of the ORC file.
type Version struct {
	name  string
	major uint32
	minor uint32
}

var (
	// Version0_11 is an ORC file version compatible with Hive 0.11.
	Version0_11 = Version{"0.11", 0, 11}
	// Version0_12 is an ORC file version compatible with Hive 0.12.
	Version0_12 = Version{"0.12", 0, 12}
)

type fileReader struct {
	*os.File
}

// Size returns the size of the file in bytes.
func (f fileReader) Size() int64 {
	stats, err := f.Stat()
	if err != nil {
		return 0
	}
	return stats.Size()
}

// Open opens the file at the provided filepath.
func Open(filepath string) (*Reader, error) {
	f, err := os.Open(filepath)
	if err != nil {
		return nil, err
	}
	return NewReader(fileReader{f})
}
