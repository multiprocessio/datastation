package runner

import (
	"io"
	"os"
	"os/exec"
)

func (ec EvalContext) evalMongo(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w io.Writer) error {
	prog := "mongo"
	_, err := exec.LookPath(prog)
	if err != nil {
		prog = "mongosh"
	}

	// TODO: how does TLS work?
	_, host, port, _, err := getHTTPHostPort(dbInfo.Address)
	if err != nil {
		return err
	}

	return ec.withRemoteConnection(server, host, port, func(proxyHost, proxyPort string) error {
		dbInfo.Address = proxyHost + ":" + proxyPort
		_, conn, err := ec.getConnectionString(dbInfo)
		if err != nil {
			return err
		}

		cmd := exec.Command(prog, conn, "--eval", panel.Content)
		cmd.Stderr = os.Stderr
		cmd.Stdout = w

		err = cmd.Start()
		if err != nil {
			return err
		}

		return cmd.Wait()
	})
}
