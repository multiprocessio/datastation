package runner

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/flosch/pongo2"
)

var logPrefixSet = false
var Verbose = true

func _logln(level, msg string, args ...interface{}) {
	if !Verbose {
		return
	}

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

func (ec EvalContext) panelResultsExist(projectId, panelId string) bool {
	resultsFile := ec.GetPanelResultsFile(projectId, panelId)
	_, err := os.Stat(resultsFile)
	return err == nil
}

func (ec EvalContext) allImportedPanelResultsExist(project ProjectState, page ProjectPage, panel PanelInfo) (string, bool) {
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
				if !ec.panelResultsExist(project.Id, idMap[nameOrIndex]) {
					return nameOrIndex, false
				}
			}
		}
	}

	return "", true
}

func (ec EvalContext) evalMacros(content string, project *ProjectState, pageIndex int) (string, error) {
	pongoJsonify := func(in *pongo2.Value, _ *pongo2.Value) (*pongo2.Value, *pongo2.Error) {
		bs, err := json.Marshal(in.Interface())
		if err != nil {
			return nil, &pongo2.Error{OrigError: err}
		}

		return pongo2.AsSafeValue(string(bs)), nil
	}
	pongo2.RegisterFilter("json", pongoJsonify)

	tpl, err := pongo2.FromString(content)
	if err != nil {
		return "", makeErrBadTemplate(err.Error())
	}

	errC := make(chan error)

	getPanel := func(nameOrIndex string) interface{} {
		panelId := ""
		for panelIndex, panel := range project.Pages[pageIndex].Panels {
			if panel.Name == nameOrIndex || fmt.Sprintf("%d", panelIndex) == nameOrIndex {
				panelId = panel.Id
				break
			}
		}

		if panelId == "" {
			errC <- makeErrInvalidDependentPanel(nameOrIndex)
		}

		resultsFile := ec.GetPanelResultsFile(project.Id, panelId)
		var a interface{}
		err := readJSONFileInto(resultsFile, &a)
		if err != nil {
			errC <- err
			return nil
		}

		return a
	}

	select {
	case err := <-errC:
		return "", err
	default:
		out, err := tpl.Execute(pongo2.Context{"DM_getPanel": getPanel})
		return out, err
	}
}

type EvalContext struct {
	settings Settings
	fsBase   string
}

func NewEvalContext(s Settings, fsBase string) EvalContext {
	return EvalContext{s, fsBase}
}

func (ec EvalContext) Eval(projectId, panelId string) error {
	project, pageIndex, panel, err := ec.getProjectPanel(projectId, panelId)
	if err != nil {
		return err
	}

	panelId, ok := ec.allImportedPanelResultsExist(*project, project.Pages[pageIndex], *panel)
	if !ok {
		return makeErrInvalidDependentPanel(panelId)
	}

	panel.Content, err = ec.evalMacros(panel.Content, project, pageIndex)
	if err != nil {
		return err
	}

	switch panel.Type {
	case FilePanel:
		Logln("Evaling file panel")
		return ec.evalFilePanel(project, pageIndex, panel)
	case HttpPanel:
		Logln("Evaling http panel")
		return ec.evalHTTPPanel(project, pageIndex, panel)
	case LiteralPanel:
		Logln("Evaling literal panel")
		return ec.evalLiteralPanel(project, pageIndex, panel)
	case ProgramPanel:
		Logln("Evaling program panel")
		fmt.Println(panel)
		return ec.evalProgramPanel(project, pageIndex, panel)
	case DatabasePanel:
		Logln("Evaling database panel")
		return ec.EvalDatabasePanel(project, pageIndex, panel, nil)
	case FilaggPanel:
		Logln("Evaling database panel")
		return ec.evalFilaggPanel(project, pageIndex, panel)
	}

	return makeErrUnsupported("Unsupported panel type " + string(panel.Type) + " in Go runner")
}
