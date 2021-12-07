package main

import (
	_ "database/sql"
	"fmt"

	_ "github.com/ClickHouse/clickhouse-go"
	_ "github.com/denisenkom/go-mssqldb"
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	_ "github.com/sijms/go-ora/v2"
)

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

	return nil
}
