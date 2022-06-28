package main

import (
	_ "github.com/alexbrainman/odbc"
	"github.com/jmoiron/sqlx"
)

func OpenODBCDriver(conn string) (*sqlx.DB, error) { return sqlx.Open("odbc", conn) }
