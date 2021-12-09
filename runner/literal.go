package main

import (
	"bytes"
	"fmt"
)

func evalLiteralPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	t := panel.Literal.ContentTypeInfo.Type
	if t == "" {
		return fmt.Errorf("Unknown type")
	}

	out := getPanelResultsFile(project.ProjectName, panel.Id)
	buf := bytes.NewBuffer([]byte(panel.Content))

	switch t {
	case "application/json":
		return transformJSON(buf, out)
	case "text/csv":
		return transformCSV(buf, out)
	}

	return fmt.Errorf("Unsupported type " + t)
}
