package main

import (
	"os"
	"path"
	"strings"
	"log"

	"github.com/multiprocessio/datastation/runner"
)

func isatty() {
	if fileInfo, _ := os.Stdout.Stat(); (fileInfo.Mode() & os.ModeCharDevice) != 0 {
		return true
	}

	return false
}

func panelResultLoader(_, _ string, res interface{}) error {
	if isatty() {
		cti, err := resolveContentType(os.Args[2])
		return runner.TransformReader(os.Stdin, res)
	} else {

	}
}

func main() {
	filestream, contentType, err := getFileInfo()
	if err != nil {
		log.Fatal(err)
	}

	inputTable := "{}"
	for i, arg := range os.Args {
		if arg == "-i" || arg == "--input-table-name" {
			if i > len(os.Args) - 2 {
				log.Fatal("Expected input table name after flag.")
			}

			inputTable = os.Args[i+1]
		}
	}

	if len(os.Args) < 3 {
		log.Fatal(`Expected query. Example: dql names.csv "SELECT name FROM {}"`)
	}

	// Query is last argument
	query := os.Args[len(os.Args)-1]
	query = strings.Replace(query, inputTable, "DM_getPanel(0)")
	panel := &runner.PanelInfo{
		Type: runner.DatabasePanel,
		DatabasePanel: &runner.DatabasePanelInfo{

		},
	}

	project := &runner.ProjectInfo{}
	connector, tmp, err := MakeTmpSQLiteConnector()
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	project.Connectors = append(project.Connectors, connector)

	err := runner.EvalDatabasePanel(project, 0, panel, panelResultLoader)
	if err != nil {
		log.Fatal(err)
	}

	// Dump the result to stdout
	fd, err := os.Open(runner.GetPanelResultsFile(project.Id, pp.Id), os.O_RDONLY)
	if err != nil {
		log.Fatalf("Could not open results file: %s", err)
	}

	io.Copy(fd, os.Stdout)
}
