package main

import (
	"github.com/stretchr/testify/assert"
	"testing"
)

func Test_getConnectionString(t *testing.T) {
	tests := []struct {
		conn            DatabaseConnectorInfoDatabase
		expectedVendor  string
		expectedConnStr string
		expectedErr     error
	}{
		{
			DatabaseConnectorInfoDatabase{Type: "postgres", Username: "jim", Password: Encrypt{Encrypted: false, Value: "pw"}, Database: "test", Address: "localhost?sslmode=disable"},
			"postgres",
			"postgres://jim:pw@localhost/test?sslmode=disable",
			nil,
		},
		{
			DatabaseConnectorInfoDatabase{Type: "postgres", Database: "test", Address: "localhost?sslmode=disable"},
			"postgres",
			"postgres://localhost/test?sslmode=disable",
			nil,
		},
		{
			DatabaseConnectorInfoDatabase{Type: "mysql", Username: "jim", Password: Encrypt{Encrypted: false, Value: "pw"}, Database: "test", Address: "localhost:9090"},
			"mysql",
			"jim:pw@tcp(localhost:9090)/test?",
			nil,
		},
		{
			DatabaseConnectorInfoDatabase{Type: "sqlite", Address: "test.sql"},
			"sqlite3",
			"test.sql",
			nil,
		},
		{
			DatabaseConnectorInfoDatabase{Type: "oracle", Username: "jim", Password: Encrypt{Encrypted: false, Value: "pw"}, Database: "test", Address: "localhost"},
			"oracle",
			"oracle://jim:pw@localhost/test?",
			nil,
		},
		{
			DatabaseConnectorInfoDatabase{Type: "sqlserver", Username: "jim", Password: Encrypt{Encrypted: false, Value: "pw"}, Database: "test", Address: "localhost"},
			"sqlserver",
			"sqlserver://jim:pw@localhost/test?",
			nil,
		},
		{
			DatabaseConnectorInfoDatabase{Type: "clickhouse", Username: "jim", Password: Encrypt{Encrypted: false, Value: "pw"}, Database: "test", Address: "localhost"},
			"clickhouse",
			"tcp://localhost?username=jim&password=pw&database=test",
			nil,
		},
		{
			DatabaseConnectorInfoDatabase{Type: "clickhouse", Password: Encrypt{Encrypted: false, Value: ""}, Database: "test", Address: "localhost"},
			"clickhouse",
			"tcp://localhost?database=test",
			nil,
		},
	}
	for _, test := range tests {
		vendor, connStr, err := getConnectionString(&ConnectorInfo{
			Type: DatabaseConnector,
			DatabaseConnectorInfo: &DatabaseConnectorInfo{
				test.conn,
			},
		})
		assert.Equal(t, test.expectedVendor, vendor)
		assert.Equal(t, test.expectedConnStr, connStr)
		assert.Equal(t, test.expectedErr, err)
	}
}
