package runner

import (
	_ "github.com/alexbrainman/odbc"
	"github.com/jmoiron/sqlx"
)

func openODBCDriver(conn string) (*sqlx.DB, error) {
	return sqlx.Open("odbc", conn)
}
