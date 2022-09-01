package runner

import (
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

func (ec EvalContext) evalNeo4j(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w *ResultWriter) error {
	_, conn, err := ec.getConnectionString(dbInfo)
	if err != nil {
		return err
	}

	password, err := ec.decrypt(&dbInfo.Password)
	if err != nil {
		return err
	}

	driver, err := neo4j.NewDriver(conn, neo4j.BasicAuth(dbInfo.Username, password, ""))
	if err != nil {
		return err
	}
	defer driver.Close()

	sess := driver.NewSession(neo4j.SessionConfig{})

	result, err := sess.Run(panel.Content, nil)
	if err != nil {
		return err
	}

	records, err := result.Collect()
	if err != nil {
		return nil
	}

	row := map[string]any{}
	for _, record := range records {
		for _, key := range record.Keys {
			value, ok := record.Get(key)
			if ok {
				row[key] = value
			} else {
				row[key] = nil
			}
		}

		if err := w.WriteRow(row); err != nil {
			return err
		}
	}

	return result.Err()
}
