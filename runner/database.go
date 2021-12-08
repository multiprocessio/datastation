package main

import (
	"encoding/base64"
	"fmt"
	"io/ioutil"
	"path"
	"strings"

	"golang.org/x/crypto/nacl/secretbox"

	_ "github.com/ClickHouse/clickhouse-go"
	_ "github.com/denisenkom/go-mssqldb"
	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	_ "github.com/sijms/go-ora/v2"
)

func (e *Encrypt) decrypt() (string, error) {
	if !e.Encrypted {
		return e.Value, nil
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
		return "", fmt.Errorf("NACL open failed")
	}

	return string(decrypted), nil
}

func getConnectionString(connector *ConnectorInfo) (string, string, error) {
	address := connector.Database.Address
	split := strings.Split(address, "?")
	address = split[0]
	extraArgs := ""
	if len(split) > 1 {
		extraArgs = strings.Join(split[1:], "?")
	}

	database := connector.Database.Database
	username := connector.Database.Username

	genericUserPass := ""
	var pass string
	if username != "" || connector.Database.Password.Value != "" {
		var err error
		pass, err = connector.Database.Password.decrypt()
		if err != nil {
			return "", "", err
		}
		genericUserPass = fmt.Sprintf("%s:%s@", username, pass)
	}

	genericString := fmt.Sprintf("%s://%s%s/%s?%s", connector.Database.Type, genericUserPass, address, database, extraArgs)

	switch connector.Database.Type {
	case PostgresDatabase:
		return "postgres", genericString, nil
	case MySQLDatabase:
		dsn := ""
		if genericUserPass != "" {
			dsn += genericUserPass
		}

		if address != "" {
			dsn += address
		}

		dsn += "/" + database + "?" + extraArgs
		return "mysql", dsn, nil
	case SQLServerDatabase:
		return "sqlserver", genericString, nil
	case OracleDatabase:
		return "oracle", genericString, nil
	case ClickhouseDatabase:
		query := ""
		if genericUserPass != "" {
			query = fmt.Sprintf("username=%s&password=%s&", username, pass)
		}

		if database != "" {
			query += "database=" + database
		}

		query += extraArgs
		return "clickhouse", fmt.Sprintf("tcp://%s?%s", address, query), nil
	case SQLiteDatabase:
		return "sqlite3", address, nil
	}

	return "", "", nil
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
		return fmt.Errorf("Unknown connector " + panel.Database.ConnectorId)
	}

	vendor, connStr, err := getConnectionString(connector)
	if err != nil {
		return err
	}

	db, err := sqlx.Open(vendor, connStr)
	if err != nil {
		return err
	}

	mangleInsert := defaultMangleInsert
	qt := ansiSQLQuoteType
	if connector.Type == "postgres" {
		mangleInsert = postgresMangleInsert
	}

	if connector.Type == "mysql" {
		qt = mysqlQuoteType
	}

	idMap := getIdMap(project.Pages[pageIndex])
	idShapeMap := getIdShapeMap(project.Pages[pageIndex])

	panelsToImport, query, err := transformDM_getPanelCalls(
		panel.Content,
		idShapeMap,
		idMap,
		connector.Type == "mysql" || connector.Type == "sqlite" || connector.Type == "postgres",
		qt,
	)

	out := getPanelResultsFile(project.ProjectName, panel.Id)

	return withJSONArrayOutWriter(out, func(w JSONArrayWriter) error {
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
					// TODO: UnicodeEscape these columns?
					row := map[string]interface{}{}
					err := rows.MapScan(row)
					if err != nil {
						return nil, err
					}

					err = w.Write(row)
					if err != nil {
						return nil, err
					}
				}

				return nil, rows.Err()

			},
			project.ProjectName,
			query,
			panelsToImport,
			qt,
			mangleInsert,
		)

		return err
	})
}
