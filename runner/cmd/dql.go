package main

import (
	"os"
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

func main() {
	filestream, contentType, err := getFileInfo()
	if err != nil {
		log.Fatal(err)
	}

	inputTable := "$$"
	for i, arg := range os.Args {
		if arg == "-i" || arg == "--input-table-name" {
			if i > len(os.Args) - 2 {
				log.Fatal("Expected input table name after flag.")
			}

			inputTable = os.Args[i+1]
		}
	}

	if len(os.Args) < 3 {
		log.Fatal(`Expected query. Example: dql names.csv "SELECT name FROM $$"`)
	}

	// Query is last argument
	query := os.Args[len(os.Args)-1]

	query = strings.Replace(query, inputTable, "DM_getPanel(0)")

	panel := &runner.NewPanelInfo(runner.ProgramPanel, query)
	panel.ProgramPanel = &runner.ProgramPanelInfo{
		Type: runner.SQL,
	}

	err = runner.Eval(panel)
	if err != nil {
		log.Fatal(err)
	}


}
