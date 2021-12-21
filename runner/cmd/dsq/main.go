package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"strings"

	"github.com/multiprocessio/datastation/runner"
)

func isinpipe() bool {
	fi, _ := os.Stdin.Stat()
	return (fi.Mode() & os.ModeCharDevice) == 0
}

func resolveContentType(fileExtensionOrContentType string) string {
	if strings.Contains(fileExtensionOrContentType, "/") {
		return fileExtensionOrContentType
	}

	return runner.GetMimeType("x."+fileExtensionOrContentType, runner.ContentTypeInfo{})
}

var firstNonFlagArg = ""

func getResult(res interface{}) error {
	out := bytes.NewBuffer(nil)
	arg := firstNonFlagArg

	var internalErr error
	if isinpipe() {
		mimetype := resolveContentType(arg)
		if mimetype == "" {
			return fmt.Errorf(`First argument when used in a pipe should be file extension or content type. e.g. 'cat test.csv | dsq csv "SELECT * FROM {}"'`)
		}

		cti := runner.ContentTypeInfo{Type: mimetype}
		internalErr = runner.TransformReader(os.Stdin, "", cti, out)
	} else {
		internalErr = runner.TransformFile(arg, runner.ContentTypeInfo{}, out)
	}
	if internalErr != nil {
		return internalErr
	}

	decoder := json.NewDecoder(out)
	return decoder.Decode(res)
}

func main() {
	if len(os.Args) < 3 {
		log.Fatal(`Expected data source and query. e.g. 'dsq names.csv "SELECT name FROM {}"'`)
	}

	runner.Verbose = false
	inputTable := "{}"
	lastNonFlagArg := ""
	for i, arg := range os.Args[1:] {
		if arg == "-i" || arg == "--input-table-alias" {
			if i > len(os.Args)-2 {
				log.Fatal(`Expected input table alias after flag. e.g. 'dsq -i XX names.csv "SELECT * FROM XX"'`)
			}

			inputTable = os.Args[i+1]
			continue
		}

		if arg == "-v" || arg == "--verbose" {
			runner.Verbose = true
			continue
		}

		if firstNonFlagArg == "" {
			firstNonFlagArg = arg
		}

		lastNonFlagArg = arg
	}

	var res []map[string]interface{}
	err := getResult(&res)
	if err != nil {
		log.Fatal(err)
	}

	sampleSize := 50
	shape, err := runner.GetArrayShape(firstNonFlagArg, res, sampleSize)
	if err != nil {
		log.Fatal(err)
	}

	p0 := runner.PanelInfo{
		ResultMeta: runner.PanelResult{
			Shape: *shape,
		},
	}
	project := &runner.ProjectState{
		Pages: []runner.ProjectPage{
			{
				Panels: []runner.PanelInfo{p0},
			},
		},
	}
	connector, tmp, err := runner.MakeTmpSQLiteConnector()
	if err != nil {
		log.Fatal(err)
	}
	defer os.Remove(tmp.Name())
	project.Connectors = append(project.Connectors, *connector)

	query := lastNonFlagArg
	query = strings.ReplaceAll(query, inputTable, "DM_getPanel(0)")
	panel := &runner.PanelInfo{
		Type:    runner.DatabasePanel,
		Content: query,
		DatabasePanelInfo: &runner.DatabasePanelInfo{
			Database: runner.DatabasePanelInfoDatabase{
				ConnectorId: connector.Id,
			},
		},
	}

	panelResultLoader := func(_, _ string, out interface{}) error {
		r := out.(*[]map[string]interface{})
		*r = res
		return nil
	}
	err = runner.EvalDatabasePanel(project, 0, panel, panelResultLoader)
	if err != nil {
		log.Fatal(err)
	}

	// Dump the result to stdout
	fd, err := os.Open(runner.GetPanelResultsFile(project.Id, panel.Id))
	if err != nil {
		log.Fatalf("Could not open results file: %s", err)
	}

	io.Copy(os.Stdout, fd)
}
