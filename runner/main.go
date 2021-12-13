package main

import (
	"log"
	"os"
	"errors"
	"time"
)

var iso8601Format = "2006-01-02T15:04:05.999Z"
var logPrefixSet = false

func _logln(level, msg string, args ...interface{}) {
	if !logPrefixSet {
		log.SetFlags(0)
		logPrefixSet = true
	}
	baseMsg := "["+level+"] " + time.Now().Format(iso8601Format) + " " + msg
	if msg[len(msg)-1] != '\n' {
		msg += "\n"
	}
	log.Printf(baseMsg, args...)
}

func logln(msg string, args ...interface{}) {
	_logln("INFO", msg, args...)
}

func fatalln(msg string, args ...interface{}) {
	_logln("FATAL", msg, args...)
	os.Exit(2)
}

func panelResultsExist(project ProjectInfo, page PageInfo, panel PanelInfo) bool {
	resultsFile := getPanelResultsFile(project.Id,)
}

func allImportedPanelResultsExist(project ProjectInfo, page PageInfo, panel PanelInfo) (string, bool) {
	idMap := getIdMap(project.Id, panel.Id)
	matchesForSubexps := dmGetPanelRe.FindAllStringSubmatch(panel.Content)
	for _, match := range matchesForSubexps {
		nameOrIndex := ""
		for i, name := range dmGetPanelRe.SubexpNames() {
			switch name {
			case "number":
				nameOrIndex = matchForSubexps[i]
			case "singlequote", "doublequote":
				// Remove quotes
				nameOrIndex = matchForSubexps[i]
				nameOrIndex = nameOrIndex[1 : len(nameOrIndex)-1]
			}

			if nameOrIndex != "" {
				if !panelResultsExist {
					return nameOrIndex, false
				}
			}
		}
	}

	return "", true
}

func eval(panelId, projectId string) error {
	project, pageIndex, panel, err := getProjectPanel(projectId, panelId)
	if err != nil {
		return err
	}

	panelId, ok := allImportedPanelResultsExist(project, project.Pages[pageIndex], panel)
	if !ok {
		return makeErrInvalidDependentPanelResults(panelId)
	}

	switch panel.Type {
	case FilePanel:
		logln("Evaling file panel")
		return evalFilePanel(project, pageIndex, panel)
	case HttpPanel:
		logln("Evaling http panel")
		return evalHttpPanel(project, pageIndex, panel)
	case LiteralPanel:
		logln("Evaling literal panel")
		return evalLiteralPanel(project, pageIndex, panel)
	case ProgramPanel:
		logln("Evaling program panel")
		return evalProgramPanel(project, pageIndex, panel)
	case DatabasePanel:
		logln("Evaling database panel")
		return evalDatabasePanel(project, pageIndex, panel)
	}

	return makeErrUnsupported("Unsupported panel type " + string(panel.Type) + " in Go runner")
}

const VERSION = "development"
const APP_NAME = "DataStation Runner (Go)"

func main() {
	logln(APP_NAME + " " + VERSION)
	projectId := ""
	panelId := ""
	panelMetaOut := ""

	args := os.Args
	for i := 0; i < len(args)-1; i++ {
		if args[i] == "--dsproj" {
			projectId = args[i+1]
			i++
			continue
		}

		if args[i] == "--evalPanel" {
			panelId = args[i+1]
			i++
			continue
		}

		if args[i] == "--metaFile" {
			panelMetaOut = args[i+1]
			i++
			continue
		}
	}

	if projectId == "" {
		fatalln("No project id given.")
	}

	if panelId == "" {
		fatalln("No panel id given.")
	}

	if panelMetaOut == "" {
		fatalln("No panel meta out given.")
	}

	err := eval(panelId, projectId)
	if err != nil {
		dse := edse(err)
		if errors.Is(err, &DSError{}) {
			dse = err.(*DSError)	
		}
		err := writeJSONFile(panelMetaOut, map[string]DSError{
			"exception": *dse,
		})
		if err != nil {
			fatalln("Could not write panel meta out: %s", err)
		}

		fatalln("Failed to eval: %s", dse)
	}
}
