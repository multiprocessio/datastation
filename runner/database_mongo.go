package runner

import (
	"fmt"
	"os/exec"
)

func (ec EvalContext) evalMongo(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w *ResultWriter) error {
	_, conn, err := ec.getConnectionString(dbInfo)
	if err != nil {
		return err
	}

	authDB, ok := dbInfo.Extra["authenticationDatabase"]
	if !ok {
		authDB = "admin"
	}

	// EJSON.stringify required to make it possible to process output
	eval := fmt.Sprintf("'EJSON.stringify(%s)'", panel.Content)

	args := []string{conn, "--quiet", "--authenticationDatabase", authDB, "--eval", eval}
	stdoutStderr, err := exec.Command("mongosh", args...).CombinedOutput()
	if err != nil {
		return makeErrUser(string(stdoutStderr))
	}

	var m any
	err = jsonUnmarshal(stdoutStderr, &m)
	if err != nil {
		return err
	}

	rows, ok := m.([]any)
	if !ok {
		jw := w.w.(*JSONResultItemWriter)
		jw.raw = true
		o := jw.bfd
		enc := jsonNewEncoder(o)

		return enc.Encode(&m)
	}

	for _, row := range rows {
		if err := w.WriteRow(row); err != nil {
			return err
		}
	}

	return nil
}
