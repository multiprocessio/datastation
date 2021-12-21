package runner

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

func Logln(msg string, args ...interface{}) {
	_logln("INFO", msg, args...)
}

func Fatalln(msg string, args ...interface{}) {
	_logln("FATAL", msg, args...)
	os.Exit(2)
}

func panelResultsExist(projectId, panelId string) bool {
	resultsFile := GetPanelResultsFile(projectId, panelId)
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

type EvalContext struct {
	settings Settings
}

func NewEvalContext(s Settings) EvalContext {
	return EvalContext{s}
}

func (ec EvalContext) Eval(projectId, panelId string) error {
	project, pageIndex, panel, err := getProjectPanel(projectId, panelId)
	if err != nil {
		return err
	}

	panelId, ok := allImportedPanelResultsExist(*project, project.Pages[pageIndex], *panel)
	if !ok {
		return makeErrInvalidDependentPanel(panelId)
	}

	switch panel.Type {
	case FilePanel:
		Logln("Evaling file panel")
		return evalFilePanel(project, pageIndex, panel)
	case HttpPanel:
		Logln("Evaling http panel")
		return evalHttpPanel(project, pageIndex, panel)
	case LiteralPanel:
		Logln("Evaling literal panel")
		return evalLiteralPanel(project, pageIndex, panel)
	case ProgramPanel:
		Logln("Evaling program panel")
		return ec.evalProgramPanel(project, pageIndex, panel)
	case DatabasePanel:
		Logln("Evaling database panel")
		return EvalDatabasePanel(project, pageIndex, panel, nil)
	case FilaggPanel:
		Logln("Evaling database panel")
		return evalFilaggPanel(project, pageIndex, panel)
	}

	return makeErrUnsupported("Unsupported panel type " + string(panel.Type) + " in Go runner")
}
