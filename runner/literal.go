package main

import (
	"bytes"
	"fmt"
)

func evalLiteralPanel(project *ProjectState, pageIndex int, panel *PanelInfo) (*PanelResult, error) {
	t := panel.Literal.ContentTypeInfo.Type
	if t == "" {
		return nil, fmt.Errorf("Unknown type")
	}

	out := getPanelResultsFile(project.ProjectName, panel)
	buf := bytes.NewBuffer([]byte(panel.Content))

	switch t {
	case "application/json":
		return transformJSON(buf, out)
	case "text/csv":
		return transformCSV(buf, out)
	}

	return nil, fmt.Errorf("Unsupported type " + t)
}
