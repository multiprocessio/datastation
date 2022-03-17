package runner

import (
	"io"

	"github.com/multiprocessio/go-json"

	"github.com/gocql/gocql"
)

func (ec EvalContext) evalCQL(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w io.Writer) error {
	_, host, port, _, err := getHTTPHostPort(dbInfo.Address)
	if err != nil {
		return err
	}

	password, err := ec.decrypt(&dbInfo.Password)
	if err != nil {
		return err
	}

	return ec.withRemoteConnection(server, host, port, func(proxyHost, proxyPort string) error {
		cluster := gocql.NewCluster(proxyHost + ":" + proxyPort)
		cluster.Keyspace = dbInfo.Database
		cluster.Consistency = gocql.Quorum
		if password != "" {
			cluster.Authenticator = gocql.PasswordAuthenticator{
				Username: dbInfo.Username,
				Password: password,
			}
		}

		sess, err := cluster.CreateSession()
		if err != nil {
			return err
		}
		defer sess.Close()

		iter := sess.Query(panel.Content).Iter()
		return withJSONArrayOutWriterFile(w, func(w *jsonutil.StreamEncoder) error {
			for {
				row := map[string]any{}
				if !iter.MapScan(row) {
					break
				}
				err := w.EncodeRow(row)
				if err != nil {
					return err
				}
			}

			return iter.Close()
		})
	})
}
