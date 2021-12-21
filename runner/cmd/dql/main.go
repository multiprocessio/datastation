package main

import (
	"bytes"
	"io"
	"fmt"
	"encoding/json"
	"os"
	"strings"
	"log"

	"github.com/multiprocessio/datastation/runner"
)

func isatty() bool {
	if fileInfo, _ := os.Stdout.Stat(); (fileInfo.Mode() & os.ModeCharDevice) != 0 {
		return true
	}

	return false
}

func resolveContentType(fileExtensionOrContentType string) string {
	if strings.Contains(fileExtensionOrContentType, "/") {
		return fileExtensionOrContentType
	}

	return runner.GetMimeType("x."+fileExtensionOrContentType, runner.ContentTypeInfo{})
}

func panelResultLoader(_, _ string, res interface{}) error {
	fmt.Println("FETCHING RESULTS")
	out := bytes.NewBuffer(nil)
	if isatty() {
		mimetype := resolveContentType(os.Args[2])
		if mimetype == "" {
			return fmt.Errorf(`First argument when used in a pipe should be file extension or content type. e.g. 'cat test.csv | dsq csv "SELECT * FROM {}"'`)
		}

		cti := runner.ContentTypeInfo{Type: mimetype}
		err := runner.TransformReader(os.Stdin, "", cti, out)
		if err != nil {
			return err
		}
	} else {
		err := runner.TransformFile(os.Args[2], runner.ContentTypeInfo{}, out)
		if err != nil {
			return err
		}
	}

	encoder := json.NewEncoder(out)
	return encoder.Encode(res)
}

func main() {
	inputTable := "{}"
	for i, arg := range os.Args {
		if arg == "-i" || arg == "--input-table-alias" {
			if i > len(os.Args) - 2 {
				log.Fatal(`Expected input table alias after flag. e.g. 'dsq -i XX names.csv "SELECT * FROM XX"'`)
			}

			inputTable = os.Args[i+1]
		}
	}

	if len(os.Args) < 3 {
		log.Fatal(`Expected query. e.g. 'dsq names.csv "SELECT name FROM {}"'`)
	}

	p0 := runner.PanelInfo{
		ResultMeta: runner.PanelResult{
			Shape: runner.Shape{
				Kind: runner.ArrayKind,
				ArrayShape: &runner.ArrayShape{
					Children: runner.Shape{
						Kind: runner.ObjectKind,
					},
				},
			},
		},
	}
	project := &runner.ProjectState{
		Pages: []runner.ProjectPage{
			runner.ProjectPage{
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

	// Query is last argument
	query := os.Args[len(os.Args)-1]
	query = strings.ReplaceAll(query, inputTable, "DM_getPanel(0)")
	panel := &runner.PanelInfo{
		Type: runner.DatabasePanel,
		Content: query,
		DatabasePanelInfo: &runner.DatabasePanelInfo{
			Database: runner.DatabasePanelInfoDatabase{
				ConnectorId: connector.Id,
			},
		},
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

	fmt.Println("Reading")
	io.Copy(fd, os.Stdout)
}
