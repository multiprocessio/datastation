package main

import "bytes"

func evalLiteralPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	cti := panel.Literal.ContentTypeInfo
	out := getPanelResultsFile(project.Id, panel.Id)
	buf := bytes.NewReader([]byte(panel.Content))
	return transformReader(buf, "", cti, out)
}
