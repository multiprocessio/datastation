package runner

import (
	"fmt"
	"io"
	"os"
	"os/exec"
)

func evalMongo(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w io.Writer) error {
	_, conn, err := getConnectionString(dbInfo)
	if err != nil {
		return err
	}

	fmt.Println("mongo %s --eval '%s'", conn, panel.Content)

	cmd := exec.Command("mongo", conn, "--eval", panel.Content)
	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout

	err = cmd.Start()
	if err != nil {
		return err
	}

	return cmd.Wait()
}
