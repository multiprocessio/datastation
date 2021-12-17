package main

import (
	"os"
)

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
	case FilaggPanel:
		logln("Evaling database panel")
		return evalFilaggPanel(project, pageIndex, panel)
	}

	return makeErrUnsupported("Unsupported panel type " + string(panel.Type) + " in Go runner")
}
