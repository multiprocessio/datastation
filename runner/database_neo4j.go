package runner

import (
	"io"

	jsonutil "github.com/multiprocessio/go-json"
	"github.com/neo4j/neo4j-go-driver/v4/neo4j"
)

func (ec EvalContext) evalNeo4j(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w io.Writer) error {
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

	return withJSONArrayOutWriterFile(w, func(w *jsonutil.StreamEncoder) error {
		records, err := result.Collect()
		if err != nil {
			return nil
		}

		for _, record := range records {
			row := make(map[string]any)

			for _, key := range record.Keys {
				value, ok := record.Get(key)
				if ok {
					row[key] = value
				}
			}

			if err := w.EncodeRow(row); err != nil {
				return err
			}
		}

		return result.Err()
	})
}
