package main

import (
	"encoding/base64"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net"
	"os"
	"path"
	"strconv"
	"strings"

	"golang.org/x/crypto/nacl/secretbox"

	_ "github.com/ClickHouse/clickhouse-go"
	_ "github.com/denisenkom/go-mssqldb"
	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	_ "github.com/sijms/go-ora/v2"
	_ "github.com/snowflakedb/gosnowflake"
)

func getDatabaseHostPort(raw, defaultPort string) (string, string, error) {
	beforeQuery := strings.Split(raw, "?")[0]
	_, _, err := net.SplitHostPort(beforeQuery)
	if err != nil && strings.HasSuffix(err.Error(), "missing port in address") {
		beforeQuery += ":" + defaultPort
	} else if err != nil {
		return "", "", edsef("Could not split host-port: %s", err)
	}

	return net.SplitHostPort(beforeQuery)
}

func debugObject(obj interface{}) {
	log.Printf("%#v\n", obj)
}

func (e *Encrypt) decrypt() (string, error) {
	if !e.Encrypted {
		return e.Value, nil
	}

	if len(e.Value) == 0 {
		return "", nil
	}

	v := e.Value
	keyBytes, err := ioutil.ReadFile(path.Join(FS_BASE, ".signingKey"))
	if err != nil {
		return "", err
	}

	keyDecoded, err := base64.StdEncoding.DecodeString(string(keyBytes))
	if err != nil {
		return "", err
	}
	messageWithNonceDecoded, err := base64.StdEncoding.DecodeString(string(v))
	if err != nil {
		return "", err
	}

	var nonce [24]byte
	copy(nonce[:24], messageWithNonceDecoded[0:24])
	var key [32]byte
	copy(key[:32], keyDecoded)

	message := messageWithNonceDecoded[24:]

	decrypted, ok := secretbox.Open(nil, message, &nonce, &key)
	if !ok {
		return "", edsef("NACL open failed")
	}

	return string(decrypted), nil
}

var defaultPorts = map[DatabaseConnectorInfoType]string{
	"postgres":      "5432",
	"mysql":         "3306",
	"sqlite":        "0",
	"sqlserver":     "1433",
	"oracle":        "1521",
	"clickhouse":    "9000",
	"cassandra":     "9160",
	"snowflake":     "443",
	"presto":        "8080",
	"elasticsearch": "9200",
	"influx":        "8086",
	"splunk":        "443",
	"prometheus":    "9090",
}

func getConnectionString(dbInfo DatabaseConnectorInfoDatabase) (string, string, error) {
	address := dbInfo.Address
	split := strings.Split(address, "?")
	address = split[0]
	extraArgs := ""
	if len(split) > 1 {
		extraArgs = strings.Join(split[1:], "?")
	}

	database := dbInfo.Database
	username := dbInfo.Username

	genericUserPass := ""
	var pass string
	if username != "" || dbInfo.Password.Value != "" {
		var err error
		pass, err = dbInfo.Password.decrypt()
		if err != nil {
			return "", "", err
		}

		genericUserPass = username
		if pass != "" {
			genericUserPass += ":" + pass
		}

		genericUserPass += "@"
	}

	genericString := fmt.Sprintf("%s://%s%s/%s?%s", dbInfo.Type, genericUserPass, address, database, extraArgs)

	switch dbInfo.Type {
	case PostgresDatabase:
		return "postgres", genericString, nil
	case MySQLDatabase:
		dsn := ""
		if genericUserPass != "" {
			dsn += genericUserPass
		}

		if address != "" {
			if !strings.Contains(address, ")") {
				if !strings.Contains(address, ":") {
					address += ":" + defaultPorts["mysql"]
				}
				address = "tcp(" + address + ")"
			}
			dsn += address
		}

		dsn += "/" + database + "?" + extraArgs
		return "mysql", dsn, nil
	case SQLServerDatabase:
		dsn := fmt.Sprintf("%s://%s%s?database=%s%s", dbInfo.Type, genericUserPass, address, database, extraArgs)
		return "sqlserver", dsn, nil
	case OracleDatabase:
		return "oracle", genericString, nil
	case SnowflakeDatabase:
		dsn := fmt.Sprintf("%s%s/%s?%s", genericUserPass, address, database, extraArgs)
		return "snowflake", dsn, nil
	case ClickhouseDatabase:
		query := ""
		if genericUserPass != "" {
			query = fmt.Sprintf("username=%s&password=%s&", username, pass)
		}

		if database != "" {
			query += "database=" + database
		}

		if !strings.Contains(address, ":") {
			address += ":" + defaultPorts["clickhouse"]
		}

		query += extraArgs
		return "clickhouse", fmt.Sprintf("tcp://%s?%s", address, query), nil
	case SQLiteDatabase:
		return "sqlite3", database, nil
	}

	return "", "", nil
}

var textTypes = map[string]bool{
	"TEXT":      true,
	"VARCHAR":   true,
	"CHAR":      true,
	"VARCHAR2":  true,
	"DATE":      true,
	"TIMESTAMP": true,
	"DATETIME":  true,
}

func writeRowFromDatabase(dbInfo DatabaseConnectorInfoDatabase, w *JSONArrayWriter, rows *sqlx.Rows, wroteFirstRow bool) error {
	row := map[string]interface{}{}
	err := rows.MapScan(row)
	if err != nil {
		return err
	}

	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return err
	}

	// The MySQL driver is not friendly about unknown data types.
	// https://github.com/go-sql-driver/mysql/issues/441
	for _, s := range colTypes {
		col := s.Name()
		bs, isBytes := row[col].([]uint8)

		if isBytes {
			switch t := strings.ToUpper(s.DatabaseTypeName()); t {
			// Explicitly skip binary types
			case "BINARY", "VARBINARY", "BLOB":
				break

				// Do conversion for ints, floats, and bools
			case "INT", "BIGINT", "INT1", "INT2", "INT4", "INT8":
				if dbInfo.Type == "mysql" {
					row[col], _ = strconv.Atoi(string(row[col].([]uint8)))
				}
			case "REAL", "BIGREAL", "NUMERIC", "DECIMAL":
				if bs, ok := row[col].([]uint8); ok {
					row[col], _ = strconv.ParseFloat(string(bs), 64)
				}
			case "BOOLEAN", "BOOL":
				row[col] = string(bs) == "true" || string(bs) == "TRUE" || string(bs) == "1"

			default:
				// Default to treating everything as a string
				row[col] = string(bs)
				if !wroteFirstRow && !textTypes[t] {
					logln("Skipping unknown type: " + s.DatabaseTypeName())
				}
			}
		}
	}

	err = w.Write(row)
	if err != nil {
		return err
	}

	return nil

}

func evalDatabasePanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	var connector *ConnectorInfo
	for _, c := range project.Connectors {
		cc := c
		if c.Id == panel.Database.ConnectorId {
			connector = &cc
			break
		}
	}

	if connector == nil {
		return edsef("Unknown connector " + panel.Database.ConnectorId)
	}

	dbInfo := connector.Database

	vendor, connStr, err := getConnectionString(dbInfo)
	if err != nil {
		return err
	}

	db, err := sqlx.Open(vendor, connStr)
	if err != nil {
		return err
	}

	mangleInsert := defaultMangleInsert
	qt := ansiSQLQuote
	if dbInfo.Type == "postgres" {
		mangleInsert = postgresMangleInsert
	}

	if dbInfo.Type == "mysql" {
		qt = mysqlQuote
	}

	idMap := getIdMap(project.Pages[pageIndex])
	idShapeMap := getIdShapeMap(project.Pages[pageIndex])

	panelsToImport, query, err := transformDM_getPanelCalls(
		panel.Content,
		idShapeMap,
		idMap,
		dbInfo.Type == "mysql" || dbInfo.Type == "sqlite" || dbInfo.Type == "postgres",
		qt,
	)
	if err != nil {
		return err
	}

	qWithoutWs := strings.TrimSpace(query)
	if qWithoutWs[len(qWithoutWs)-1] != ';' {
		qWithoutWs += ";"
	}

	server, err := getServer(project, panel.ServerId)
	if err != nil {
		return err
	}

	// Copy remote sqlite database to tmp file if remote
	if dbInfo.Type == "sqlite" && server != nil {
		tmp, err := ioutil.TempFile("", "sqlite-copy")
		if err != nil {
			return err
		}

		defer os.Remove(tmp.Name())

		err = remoteFileReader(*server, dbInfo.Database, func(r io.Reader) error {
			_, err := io.Copy(tmp, r)
			return err
		})
		if err != nil {
			return err
		}

		dbInfo.Database = tmp.Name()
		tmp.Close()
	}

	host, port, err := getDatabaseHostPort(dbInfo.Address, defaultPorts[dbInfo.Type])
	if err != nil {
		return err
	}

	return withRemoteConnection(server, host, port, func(host, port string) error {
		out := getPanelResultsFile(project.Id, panel.Id)

		wroteFirstRow := false
		return withJSONArrayOutWriterFile(out, func(w *JSONArrayWriter) error {
			_, err := importAndRun(
				func(createTableStmt string) error {
					_, err := db.Exec(createTableStmt)
					return err
				},
				func(insertStmt string, values []interface{}) error {
					_, err := db.Exec(insertStmt, values...)
					return err
				},
				func(query string) ([]map[string]interface{}, error) {
					rows, err := db.Queryx(query)
					if err != nil {
						return nil, err
					}
					defer rows.Close()

					for rows.Next() {
						err := writeRowFromDatabase(dbInfo, w, rows, wroteFirstRow)
						if err != nil {
							return nil, err
						}

						wroteFirstRow = true
					}

					return nil, rows.Err()

				},
				project.Id,
				qWithoutWs,
				panelsToImport,
				qt,
				mangleInsert,
			)

			return err
		})
	})
}
