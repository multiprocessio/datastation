package runner

import (
	"database/sql"
	"regexp"

	"github.com/multiprocessio/go-sqlite3-stdlib"
)

func init() {
	stdlib.Register("sqlite3_extended")
}
