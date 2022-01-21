package runner

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_getConnectionString(t *testing.T) {
	tests := []struct {
		conn       DatabaseConnectorInfoDatabase
		expVendor  string
		expConnStr string
		expErr     error
		expHost    string
		expPort    string
		expExtra   string
	}{
		{
			DatabaseConnectorInfoDatabase{Type: "postgres", Username: "jim", Password: Encrypt{Encrypted: false, Value: "pw"}, Database: "test", Address: "localhost?sslmode=disable"},
			"postgres",
			"postgres://jim:pw@localhost/test?sslmode=disable",
			nil,
			"localhost",
			"5432",
			"sslmode=disable",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "postgres", Database: "test", Address: "big.com:8888?sslmode=disable"},
			"postgres",
			"postgres://big.com:8888/test?sslmode=disable",
			nil,
			"big.com",
			"8888",
			"sslmode=disable",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "mysql", Username: "jim", Password: Encrypt{Encrypted: false, Value: "pw"}, Database: "test", Address: "localhost:9090"},
			"mysql",
			"jim:pw@tcp(localhost:9090)/test?",
			nil,
			"localhost",
			"9090",
			"",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "sqlite", Database: "test.sql"},
			"sqlite3",
			"test.sql",
			nil,
			"",
			"",
			"",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "oracle", Username: "jim", Password: Encrypt{Encrypted: false, Value: "pw"}, Database: "test", Address: ""},
			"oracle",
			"oracle://jim:pw@localhost/test?",
			nil,
			"",
			"1521",
			"",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "oracle", Username: "jim", Password: Encrypt{Encrypted: false, Value: "pw"}, Database: "test", Address: "localhost"},
			"oracle",
			"oracle://jim:pw@localhost/test?",
			nil,
			"localhost",
			"1521",
			"",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "snowflake", Username: "jim", Password: Encrypt{Encrypted: false, Value: ""}, Database: "test", Address: "myid"},
			"snowflake",
			"jim@myid/test?",
			nil,
			"",
			"",
			"",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "snowflake", Username: "jim", Password: Encrypt{Encrypted: false, Value: "pw"}, Database: "test", Address: "myid?x=y"},
			"snowflake",
			"jim:pw@myid/test?x=y",
			nil,
			"",
			"",
			"x=y",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "sqlserver", Username: "jim", Password: Encrypt{Encrypted: false, Value: "pw"}, Database: "test", Address: "localhost"},
			"sqlserver",
			"sqlserver://jim:pw@localhost?database=test",
			nil,
			"localhost",
			"1433",
			"",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "clickhouse", Username: "jim", Password: Encrypt{Encrypted: false, Value: "pw"}, Database: "test", Address: "localhost"},
			"clickhouse",
			"tcp://localhost:9000?username=jim&password=pw&database=test",
			nil,
			"localhost",
			"9000",
			"",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "clickhouse", Password: Encrypt{Encrypted: false, Value: ""}, Database: "test", Address: "localhost:9001"},
			"clickhouse",
			"tcp://localhost:9001?database=test",
			nil,
			"localhost",
			"9001",
			"",
		},
	}
	for _, test := range tests {
		vendor, connStr, err := getConnectionString(test.conn)
		assert.Equal(t, test.expVendor, vendor)
		assert.Equal(t, test.expConnStr, connStr)
		assert.Equal(t, test.expErr, err)

		if test.expVendor == "sqlite" || test.expVendor == "snowflake" {
			continue
		}

		host, port, extra, err := getDatabaseHostPortExtra(test.conn.Address, defaultPorts[DatabaseConnectorInfoType(test.expVendor)])
		assert.Nil(t, err)
		assert.Equal(t, test.expHost, host)
		assert.Equal(t, test.expPort, port)
		assert.Equal(t, test.expExtra, extra)
	}
}
