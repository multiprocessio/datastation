package runner

import (
	"github.com/multiprocessio/go-sqlite3-stdlib"
)

func init() {
	stdlib.Register("sqlite3_extended")
}
