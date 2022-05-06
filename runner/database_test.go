package runner

import (
	"fmt"
	"strings"
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
			"jim:pw@tcp(localhost:9090)/test",
			nil,
			"localhost",
			"9090",
			"",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "sqlite", Database: "test.sql"},
			"sqlite3_extended",
			"test.sql",
			nil,
			"",
			"",
			"",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "oracle", Username: "jim", Password: Encrypt{Encrypted: false, Value: "pw"}, Database: "test", Address: ""},
			"oracle",
			"oracle://jim:pw@localhost/test",
			nil,
			"",
			"1521",
			"",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "oracle", Username: "jim", Password: Encrypt{Encrypted: false, Value: "pw"}, Database: "test", Address: "localhost"},
			"oracle",
			"oracle://jim:pw@localhost/test",
			nil,
			"localhost",
			"1521",
			"",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "snowflake", Username: "jim", Password: Encrypt{Encrypted: false, Value: ""}, Database: "test", Extra: map[string]string{"account": "myid"}},
			"snowflake",
			"jim@myid/test",
			nil,
			"",
			"",
			"",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "snowflake", Username: "jim", Password: Encrypt{Encrypted: false, Value: "pw"}, Database: "test", Extra: map[string]string{"account": "myid"}},
			"snowflake",
			"jim:pw@myid/test",
			nil,
			"",
			"",
			"",
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
		{
			DatabaseConnectorInfoDatabase{Type: "neo4j", Password: Encrypt{Encrypted: false, Value: ""}, Database: "test", Address: "localhost:7687"},
			"neo4j",
			"neo4j://localhost:7687",
			nil,
			"localhost",
			"7687",
			"",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "neo4j", Password: Encrypt{Encrypted: false, Value: ""}, Database: "test", Address: "neo4j+s://localhost"},
			"neo4j",
			"neo4j+s://localhost:7687",
			nil,
			"localhost",
			"7687",
			"",
		},
		{
			DatabaseConnectorInfoDatabase{Type: "odbc", Password: Encrypt{Encrypted: false, Value: ""}, Username: "SA", Database: "master", Address: "localhost:1433", Extra: map[string]string{"driver": "freetds"}},
			"odbc",
			"driver=freetds;server=localhost,1433;database=master;pwd=;uid=SA;",
			nil,
			"localhost",
			"1433",
			"",
		},
	}

	ec, cleanup := makeTestEvalContext()
	defer cleanup()

	for _, test := range tests {
		vendor, connStr, err := ec.getConnectionString(test.conn)
		assert.Equal(t, test.expVendor, vendor)
		if test.expVendor == ODBCDatabase {
			assert.Equal(t, nil, odbcAssert(test.expConnStr, connStr))
		} else {
			assert.Equal(t, test.expConnStr, connStr)
		}
		assert.Equal(t, test.expErr, err)

		if test.expVendor == "sqlite" || test.expVendor == "snowflake" || test.expVendor == "neo4j" {
			continue
		}

		host, port, extra, err := getDatabaseHostPortExtra(test.conn.Address, defaultPorts[DatabaseConnectorInfoType(test.expVendor)])
		assert.Nil(t, err)
		assert.Equal(t, test.expHost, host)
		assert.Equal(t, test.expPort, port)
		assert.Equal(t, test.expExtra, extra)
	}
}

func odbcAssert(exp, act string) error {
	expSlice := strings.Split(exp, ";")
	actSlice := strings.Split(act, ";")
	lookUp := map[string]bool{}

	for _, s := range expSlice {
		lookUp[s] = true
	}

	for _, s := range actSlice {
		if _, ok := lookUp[s]; !ok {
			return fmt.Errorf("not equal: %s, %s", exp, act)
		}
	}

	return nil
}
