package runner

import (
	"io"

	jsonutil "github.com/multiprocessio/go-json"
	"github.com/neo4j/neo4j-go-driver/v4/neo4j"
)

func (ec EvalContext) evalNeo4j(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w io.Writer) error {
	_, host, port, _, err := getHTTPHostPort(dbInfo.Address)
	if err != nil {
		return err
	}

	password, err := ec.decrypt(&dbInfo.Password)
	if err != nil {
		return err
	}

	return ec.withRemoteConnection(server, host, port, func(proxyHost, proxyPort string) error {
		driver, err := neo4j.NewDriver(proxyHost+":"+proxyPort, neo4j.BasicAuth(dbInfo.Username, password, ""))
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
				var row map[string]any

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
	})
}
