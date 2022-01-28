package runner

import (
	"io"
	"os"
	"os/exec"
)

func evalMongo(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w io.Writer) error {
	_, conn, err := getConnectionString(dbInfo)
	if err != nil {
		return err
	}

	prog := "mongo"
	test := exec.StartProcess("sh", "-c", "command -v mongo")
	_, err = test.Wait()
	if err != nil {
		prog = "mongosh"
	}

	cmd := exec.Command(prog, conn, "--eval", panel.Content)
	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout

	err = cmd.Start()
	if err != nil {
		return err
	}

	return cmd.Wait()
}
