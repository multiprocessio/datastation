package runner

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"

	_ "github.com/ClickHouse/clickhouse-go/v2"
	_ "github.com/alexbrainman/odbc"
	_ "github.com/denisenkom/go-mssqldb"
	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	jsonutil "github.com/multiprocessio/go-json"
	_ "github.com/sijms/go-ora/v2"
	_ "github.com/snowflakedb/gosnowflake"
)

type databaseInfo struct {
	id                 *DatabaseConnectorInfo
	defaultPort        string
	driverNameOverride string // like `postgres` for `cockroach`
	eval               func(project *ProjectState,
		pageIndex int,
		panel *PanelInfo,
		panelResultLoader func(projectId, panelId string) (chan map[string]any, error),
		cache CacheSettings,
	) error
	// make a minimal request to validate connectivityS
	// return nil on success and fail if context.Context times out
	testConnection func(context.Context, *DatabaseConnectorInfo) error
}

func (db *databaseInfo) SetTestConnection(testConn func(context.Context, *DatabaseConnectorInfo) error) *databaseInfo {
	db.testConnection = testConn
	return db
}

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

var SQLITE_PRAGMAS = []string{
	"journal_mode = WAL",
	"synchronous = normal",
	"temp_store = memory",
	"mmap_size = 30000000000",
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
	Neo4jDatabase:         "7687",
	ODBCDatabase:          "1433",
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

func (ec EvalContext) getGenericConnectionString(dbInfo DatabaseConnectorInfoDatabase) (string, string, error) {
	u := getURLParts(dbInfo)
	genericUserPass := ""
	var pass string
	if u.username != "" || dbInfo.Password.Value != "" {
		var err error
		pass, err = ec.decrypt(&dbInfo.Password)
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

func (ec EvalContext) getConnectionString(dbInfo DatabaseConnectorInfoDatabase) (string, string, error) {
	u := getURLParts(dbInfo)
	genericString, genericUserPass, err := ec.getGenericConnectionString(dbInfo)
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
			genericString, _, _ = ec.getGenericConnectionString(dbInfo)
		}
		return "oracle", genericString, nil
	case SnowflakeDatabase:
		dbInfo.Address = dbInfo.Extra["account"]
		genericString, _, _ = ec.getGenericConnectionString(dbInfo)
		dsn := genericString[len("snowflake://"):] // Snowflake library doesn't use this prefix
		return "snowflake", dsn, nil
	case ClickHouseDatabase:
		query := ""
		if genericUserPass != "" {
			// Already proven to be ok
			pass, _ := ec.decrypt(&dbInfo.Password)
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
	case Neo4jDatabase:
		addr, err := url.Parse(u.address)
		if err != nil {
			return "", "", err
		}

		// prevent localhost from registerring as a scheme in localhost:7687
		if addr.Opaque != "" {
			addr, err = url.Parse("//" + u.address)
			if err != nil {
				return "", "", err
			}
		}

		if addr.Scheme == "" {
			addr.Scheme = Neo4jDatabase
		}

		if addr.Port() == "" {
			addr.Host += ":" + "7687"
		}

		_, _, err = net.SplitHostPort(addr.Host)
		if err != nil {
			return "", "", err
		}

		return "neo4j", addr.String(), nil
	case ODBCDatabase:
		params := map[string]string{}
		var err error

		if strings.Contains(u.address, "localhost") {
			split := strings.Split(u.address, ":")
			params["server"] = fmt.Sprintf("%s,%s", split[0], split[1])
		} else {
			addr, err := url.Parse(u.address)
			if err != nil {
				return "", "", err
			}
			params["server"] = fmt.Sprintf("%s,%s", addr.Hostname(), addr.Port())
		}
		params["database"] = u.database

		var ok bool
		params["driver"], ok = dbInfo.Extra["driver"]
		if !ok {
			return "", "", fmt.Errorf("driver not found")
		}

		params["pwd"], err = ec.decrypt(&dbInfo.Password)
		if err != nil {
			return "", "", err
		}
		params["uid"] = dbInfo.Username
		if dbInfo.Username == "" {
			params["trusted_connection"] = "yes" // TODO: configure TLS
		}
		params["trust_server_certificate"] = "yes" // TODO: use as an option

		var conn string
		for k, v := range params {
			conn += k + "=" + v + ";"
		}

		return "odbc", conn, nil
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
	row := map[string]any{}
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

func (ec EvalContext) loadJSONArrayPanel(projectId, panelId string) (chan map[string]any, error) {
	f := ec.GetPanelResultsFile(projectId, panelId)
	return loadJSONArrayFile(f)
}

func (ec EvalContext) EvalDatabasePanel(
	project *ProjectState,
	pageIndex int,
	panel *PanelInfo,
	panelResultLoader func(projectId, panelId string) (chan map[string]any, error),
	cache CacheSettings,
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

	// A few database types are cool with empty queries
	if panel.Content == "" &&
		dbInfo.Type != ElasticsearchDatabase &&
		dbInfo.Type != AirtableDatabase &&
		dbInfo.Type != GoogleSheetsDatabase {
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
	w, closeFile, err := openTruncateBufio(out)
	if err != nil {
		return err
	}
	defer closeFile()
	defer w.Flush()

	if dbInfo.Address == "" {
		dbInfo.Address = "localhost:" + defaultPorts[dbInfo.Type]
	}

	switch dbInfo.Type {
	case ElasticsearchDatabase:
		return ec.evalElasticsearch(panel, dbInfo, server, w)
	case InfluxDatabase:
		return ec.evalInfluxQL(panel, dbInfo, server, w)
	case InfluxFluxDatabase:
		return ec.evalFlux(panel, dbInfo, server, w)
	case PrometheusDatabase:
		return ec.evalPrometheus(panel, dbInfo, server, w)
	case BigQueryDatabase:
		return ec.evalBigQuery(panel, dbInfo, w)
	case SplunkDatabase:
		return evalSplunk(panel, dbInfo, server, w)
	case MongoDatabase:
		return ec.evalMongo(panel, dbInfo, server, w)
	case CassandraDatabase, ScyllaDatabase:
		return ec.evalCQL(panel, dbInfo, server, w)
	case AthenaDatabase:
		return ec.evalAthena(panel, dbInfo, w)
	case GoogleSheetsDatabase:
		return ec.evalGoogleSheets(panel, dbInfo, w)
	case AirtableDatabase:
		return ec.evalAirtable(panel, dbInfo, w)
	case Neo4jDatabase:
		return ec.evalNeo4j(panel, dbInfo, server, w)
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
		cache.CachePresent,
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

		err = ec.remoteFileReader(*server, dbInfo.Database, func(r *bufio.Reader) error {
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

	return ec.withRemoteConnection(server, host, port, func(proxyHost, proxyPort string) error {
		dbInfo.Address = proxyHost + ":" + proxyPort
		if extra != "" {
			dbInfo.Address += "?" + extra
		}
		vendor, connStr, err := ec.getConnectionString(dbInfo)
		if err != nil {
			return err
		}

		db, err := sqlx.Open(vendor, connStr)
		if err != nil {
			return err
		}

		if vendor == "sqlite3_extended" {
			for _, pragma := range SQLITE_PRAGMAS {
				_, err = db.Exec("PRAGMA " + pragma)
				if err != nil {
					return err
				}
			}
		}

		preparer := func(q string) (func([]any) error, func(), error) {
			stmt, err := db.Prepare(mangleInsert(q))
			if err != nil {
				return nil, nil, err
			}

			return func(values []any) error {
					_, err := stmt.Exec(values...)
					return err
				}, func() {
					stmt.Close()
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
				func(query string) ([]map[string]any, error) {
					rows, err := db.Queryx(query)
					if err != nil {
						if vendor == ODBCDatabase && err.Error() == "Stmt did not create a result set" {
							return nil, nil
						}
						// odbc driver returns an error for an empty result
						// see https://github.com/alexbrainman/odbc/blob/9c9a2e61c5e2c1a257a51ea49169fc9008c51f0e/odbcstmt.go#L134
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
				cache,
			)

			return err
		})
	})
}
