//go:build darwin || linux || freebsd

package runner

import (
	"plugin"

	"github.com/jmoiron/sqlx"
)

// On UNIX systems, openODBCDriver loads a Go plugin to prevent the runtime dependency on unixODBC.
func openODBCDriver(conn string) (*sqlx.DB, error) {
	pl, err := plugin.Open("./runner/plugins/odbc/odbc.build")
	if err != nil {
		return nil, err
	}

	openDriver, err := pl.Lookup("OpenODBCDriver")
	if err != nil {
		return nil, err
	}

	return openDriver.(func(string) (*sqlx.DB, error))(conn)
}
