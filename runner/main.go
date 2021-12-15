package main

import (
	"log"
	"os"
	"time"
)

var iso8601Format = "2006-01-02T15:04:05.999Z"
var logPrefixSet = false

func _logln(level, msg string, args ...interface{}) {
	if !logPrefixSet {
		log.SetFlags(0)
		logPrefixSet = true
	}
	baseMsg := "[" + level + "] " + time.Now().Format(iso8601Format) + " " + msg
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

func panelResultsExist(projectId, panelId string) bool {
	resultsFile := getPanelResultsFile(projectId, panelId)
	_, err := os.Stat(resultsFile)
	return err == nil
}

func allImportedPanelResultsExist(project ProjectState, page ProjectPage, panel PanelInfo) (string, bool) {
	idMap := getIdMap(page)
	matchesForSubexps := dmGetPanelRe.FindAllStringSubmatch(panel.Content, -1)
	for _, match := range matchesForSubexps {
		nameOrIndex := ""
		for i, name := range dmGetPanelRe.SubexpNames() {
			switch name {
			case "number":
				nameOrIndex = match[i]
			case "singlequote", "doublequote":
				// Remove quotes
				nameOrIndex = match[i]
				if nameOrIndex != "" {
					nameOrIndex = nameOrIndex[1 : len(nameOrIndex)-1]
				}
			}

			if nameOrIndex != "" {
				if !panelResultsExist(project.Id, idMap[nameOrIndex]) {
					return nameOrIndex, false
				}
			}
		}
	}

	return "", true
}

type evalContext struct {
	settings Settings
}

func (ec evalContext) eval(panelId, projectId string) error {
	project, pageIndex, panel, err := getProjectPanel(projectId, panelId)
	if err != nil {
		return err
	}

	panelId, ok := allImportedPanelResultsExist(*project, project.Pages[pageIndex], *panel)
	if !ok {
		return makeErrInvalidDependentPanelError(panelId)
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
		return ec.evalProgramPanel(project, pageIndex, panel)
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

	settings, err := loadSettings()
	if err != nil {
		logln("Could not load settings, assuming defaults.")
		settings = defaultSettings
	}

	ec := evalContext{*settings}

	err = ec.eval(panelId, projectId)
	if err != nil {
		logln("Failed to eval: %s", err)

		err := writeJSONFile(panelMetaOut, map[string]string{
			"exception": err.Error(),
		})
		if err != nil {
			fatalln("Could not write panel meta out: %s", err)
		}

		// Explicitly don't fail here so that the parent can read the exception from disk
	}
}
