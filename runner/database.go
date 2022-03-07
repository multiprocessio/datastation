package runner

import (
	"encoding/base64"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net"
	"net/url"
	"os"
	"path"
	"strconv"
	"strings"

	"golang.org/x/crypto/nacl/secretbox"

	"github.com/multiprocessio/go-json"

	_ "github.com/ClickHouse/clickhouse-go/v2"
	_ "github.com/denisenkom/go-mssqldb"
	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	_ "github.com/sijms/go-ora/v2"
	_ "github.com/snowflakedb/gosnowflake"
)

func getDatabaseHostPortExtra(raw, defaultPort string) (string, string, string, error) {
	addressAndArgs := strings.SplitN(raw, "?", 2)
	extra := ""
	beforeQuery := addressAndArgs[0]
	if len(addressAndArgs) > 1 {
		extra = addressAndArgs[1]
	}
	_, _, err := net.SplitHostPort(beforeQuery)
	if err != nil && strings.HasSuffix(err.Error(), "missing port in address") {
		beforeQuery += ":" + defaultPort
	} else if err != nil {
		return "", "", "", edsef("Could not split host-port: %s", err)
	}

	host, port, err := net.SplitHostPort(beforeQuery)
	return host, port, extra, err
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
	keyBytes, err := ioutil.ReadFile(path.Join(CONFIG_FS_BASE, ".signingKey"))
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
	PostgresDatabase:      "5432",
	MySQLDatabase:         "3306",
	SQLServerDatabase:     "1433",
	OracleDatabase:        "1521",
	ClickHouseDatabase:    "9000",
	CassandraDatabase:     "9160",
	ScyllaDatabase:        "9042",
	SnowflakeDatabase:     "443",
	PrestoDatabase:        "8080",
	ElasticsearchDatabase: "9200",
	InfluxDatabase:        "8086",
	InfluxFluxDatabase:    "8086",
	SplunkDatabase:        "443",
	PrometheusDatabase:    "9090",
	CockroachDatabase:     "26257",
	CrateDatabase:         "5432",
	TimescaleDatabase:     "5432",
	YugabyteDatabase:      "5433",
	QuestDatabase:         "8812",
}

type urlParts struct {
	address   string
	database  string
	username  string
	extraArgs string
}

func getURLParts(dbInfo DatabaseConnectorInfoDatabase) urlParts {
	address := dbInfo.Address
	split := strings.SplitN(address, "?", 2)
	address = split[0]
	extraArgs := ""
	if len(split) > 1 {
		extraArgs = strings.Join(split[1:], "?")
	}

	database := dbInfo.Database
	username := dbInfo.Username

	return urlParts{
		address:   address,
		database:  database,
		username:  username,
		extraArgs: extraArgs,
	}
}

var dbDriverOverride = map[DatabaseConnectorInfoType]string{
	MongoDatabase:     "mongodb",
	CrateDatabase:     "postgres",
	QuestDatabase:     "postgres",
	TimescaleDatabase: "postgres",
	YugabyteDatabase:  "postgres",
	CockroachDatabase: "postgres",
}

func getGenericConnectionString(dbInfo DatabaseConnectorInfoDatabase) (string, string, error) {
	u := getURLParts(dbInfo)
	genericUserPass := ""
	var pass string
	if u.username != "" || dbInfo.Password.Value != "" {
		var err error
		pass, err = dbInfo.Password.decrypt()
		if err != nil {
			return "", "", err
		}

		genericUserPass = u.username
		if pass != "" {
			genericUserPass += ":" + url.QueryEscape(pass)
		}

		genericUserPass += "@"
	}

	extra := u.extraArgs
	if len(extra) > 0 && extra[0] != '?' {
		extra = "?" + extra
	}

	driver := string(dbInfo.Type)
	if d, ok := dbDriverOverride[dbInfo.Type]; ok {
		driver = d
	}

	genericString := fmt.Sprintf(
		"%s://%s%s/%s%s",
		driver,
		genericUserPass,
		u.address,
		u.database,
		extra)

	return genericString, genericUserPass, nil
}

func getConnectionString(dbInfo DatabaseConnectorInfoDatabase) (string, string, error) {
	u := getURLParts(dbInfo)
	genericString, genericUserPass, err := getGenericConnectionString(dbInfo)
	if err != nil {
		return "", "", err
	}

	switch dbInfo.Type {
	case PostgresDatabase, TimescaleDatabase, CockroachDatabase, CrateDatabase, YugabyteDatabase, QuestDatabase:
		return "postgres", genericString, nil
	case MongoDatabase:
		return "mongodb", genericString, nil
	case MySQLDatabase:
		dsn := ""
		if genericUserPass != "" {
			dsn += genericUserPass
		}

		// MySQL driver has a pretty unique format.
		if u.address != "" {
			if !strings.Contains(u.address, ")") {
				if !strings.Contains(u.address, ":") {
					u.address += ":" + defaultPorts["mysql"]
				}
				u.address = "tcp(" + u.address + ")"
			}
			dsn += u.address
		}

		dsn += "/" + u.database
		if len(u.extraArgs) > 0 {
			if u.extraArgs[0] != '?' {
				dsn += "?"
			}

			dsn += u.extraArgs
		}
		return "mysql", dsn, nil
	case SQLServerDatabase:
		dsn := fmt.Sprintf("%s://%s%s?database=%s%s",
			dbInfo.Type,
			genericUserPass,
			u.address,
			u.database,
			u.extraArgs)
		return "sqlserver", dsn, nil
	case OracleDatabase:
		// The Oracle driver we use is not cool with blank address
		if dbInfo.Address == "" || dbInfo.Address[0] == ':' {
			dbInfo.Address = "localhost"
			genericString, _, _ = getGenericConnectionString(dbInfo)
		}
		return "oracle", genericString, nil
	case SnowflakeDatabase:
		dbInfo.Address = dbInfo.Extra["account"]
		genericString, _, _ = getGenericConnectionString(dbInfo)
		dsn := genericString[len("snowflake://"):] // Snowflake library doesn't use this prefix
		return "snowflake", dsn, nil
	case ClickHouseDatabase:
		query := ""
		if genericUserPass != "" {
			// Already proven to be ok
			pass, _ := dbInfo.Password.decrypt()
			query = fmt.Sprintf("username=%s&password=%s&", u.username, pass)
		}

		if u.database != "" {
			query += "database=" + u.database
		}

		if !strings.Contains(u.address, ":") {
			u.address += ":" + defaultPorts["clickhouse"]
		}

		query += u.extraArgs
		return "clickhouse", fmt.Sprintf("tcp://%s?%s", u.address, query), nil
	case SQLiteDatabase:
		// defined in database_sqlite.go, includes regexp support
		return "sqlite3_extended", resolvePath(u.database), nil
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

func writeRowFromDatabase(dbInfo DatabaseConnectorInfoDatabase, w *jsonutil.StreamEncoder, rows *sqlx.Rows, wroteFirstRow bool) error {
	row := map[string]interface{}{}
	err := rows.MapScan(row)
	if err != nil {
		return err
	}

	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return err
	}

	// Needing this whole translation layer may be a good reason
	// not to use sqlx since it translates **into** this layer
	// from being raw.  At this point we're just reimplementing
	// sqlx in reverse on top of sqlx. Might be better to do
	// reflection directly on the sql package instead. Would be
	// worth benchmarking.

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
					row[col], err = strconv.Atoi(string(row[col].([]uint8)))
					if err != nil {
						return edsef("Failed to convert int (%s): %s", t, err)
					}
				}
			case "REAL", "BIGREAL", "NUMERIC", "DECIMAL", "FLOAT", "NUMBER":
				if bs, ok := row[col].([]uint8); ok {
					row[col], err = strconv.ParseFloat(string(bs), 64)
					if err != nil {
						return edsef("Failed to convert float (%s): %s", t, err)
					}
				}
			case "BOOLEAN", "BOOL":
				row[col] = string(bs) == "true" || string(bs) == "TRUE" || string(bs) == "1"

			default:
				// Default to treating everything as a string
				row[col] = string(bs)
				if !wroteFirstRow && !textTypes[t] {
					Logln("Skipping unknown type: " + s.DatabaseTypeName())
				}
			}
		}
	}

	err = w.EncodeRow(row)
	if err != nil {
		return err
	}

	return nil
}

func (ec EvalContext) loadJSONArrayPanel(projectId, panelId string) (chan map[string]interface{}, error) {
	f := ec.GetPanelResultsFile(projectId, panelId)
	return loadJSONArrayFile(f)
}

func (ec EvalContext) EvalDatabasePanel(
	project *ProjectState,
	pageIndex int,
	panel *PanelInfo,
	panelResultLoader func(projectId, panelId string) (chan map[string]interface{}, error),
) error {
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

	// Only Elasticsearch is ok with an empty query, I think.
	if panel.Content == "" && dbInfo.Type != ElasticsearchDatabase && dbInfo.Type != AirtableDatabase {
		return edsef("Expected query, got empty query.")
	}

	if panelResultLoader == nil {
		panelResultLoader = ec.loadJSONArrayPanel
	}

	serverId := panel.ServerId
	if serverId == "" {
		serverId = connector.ServerId
	}
	server, err := getServer(project, serverId)
	if err != nil {
		return err
	}

	out := ec.GetPanelResultsFile(project.Id, panel.Id)
	w, err := openTruncate(out)
	if err != nil {
		return err
	}
	defer w.Close()

	if dbInfo.Address == "" {
		dbInfo.Address = "localhost:" + defaultPorts[dbInfo.Type]
	}

	switch dbInfo.Type {
	case ElasticsearchDatabase:
		return evalElasticsearch(panel, dbInfo, server, w)
	case InfluxDatabase:
		return ec.evalInfluxQL(panel, dbInfo, server, w)
	case InfluxFluxDatabase:
		return evalFlux(panel, dbInfo, server, w)
	case PrometheusDatabase:
		return evalPrometheus(panel, dbInfo, server, w)
	case BigQueryDatabase:
		return evalBigQuery(panel, dbInfo, w)
	case SplunkDatabase:
		return evalSplunk(panel, dbInfo, server, w)
	case MongoDatabase:
		return evalMongo(panel, dbInfo, server, w)
	case CassandraDatabase, ScyllaDatabase:
		return evalCQL(panel, dbInfo, server, w)
	case AthenaDatabase:
		return evalAthena(panel, dbInfo, w)
	case GoogleSheetsDatabase:
		return evalGoogleSheets(panel, dbInfo, w)
	case AirtableDatabase:
		return evalAirtable(panel, dbInfo, w)
	}

	mangleInsert := defaultMangleInsert
	qt := ansiSQLQuote
	if dbInfo.Type == PostgresDatabase {
		mangleInsert = postgresMangleInsert
	}

	if dbInfo.Type == MySQLDatabase {
		qt = mysqlQuote
	}

	idMap := getIdMap(project.Pages[pageIndex])
	idShapeMap := getIdShapeMap(project.Pages[pageIndex])

	panelsToImport, query, err := transformDM_getPanelCalls(
		panel.Content,
		idShapeMap,
		idMap,
		dbInfo.Type == MySQLDatabase || dbInfo.Type == SQLiteDatabase || dbInfo.Type == PostgresDatabase,
		qt,
	)
	if err != nil {
		return err
	}

	// Copy remote sqlite database to tmp file if remote
	if dbInfo.Type == SQLiteDatabase && server != nil {
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
	}

	host, port, extra, err := getDatabaseHostPortExtra(dbInfo.Address, defaultPorts[dbInfo.Type])
	if err != nil {
		return err
	}

	return withRemoteConnection(server, host, port, func(proxyHost, proxyPort string) error {
		dbInfo.Address = proxyHost + ":" + proxyPort
		if extra != "" {
			dbInfo.Address += "?" + extra
		}
		vendor, connStr, err := getConnectionString(dbInfo)
		if err != nil {
			return err
		}

		db, err := sqlx.Open(vendor, connStr)
		if err != nil {
			return err
		}

		preparer := func(q string) (func([]interface{}) error, error) {
			stmt, err := db.Prepare(mangleInsert(q))
			if err != nil {
				return nil, err
			}

			return func(values []interface{}) error {
				_, err := stmt.Exec(values...)
				return err
			}, nil
		}

		wroteFirstRow := false
		return withJSONArrayOutWriterFile(w, func(w *jsonutil.StreamEncoder) error {
			_, err := importAndRun(
				func(createTableStmt string) error {
					_, err := db.Exec(createTableStmt)
					return err
				},
				preparer,
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
				query,
				panelsToImport,
				qt,
				panelResultLoader,
			)

			return err
		})
	})
}
