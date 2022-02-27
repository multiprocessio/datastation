package runner

import "bytes"

func (ec EvalContext) evalLiteralPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	cti := panel.Literal.ContentTypeInfo
	out := ec.GetPanelResultsFile(project.Id, panel.Id)
	w, err := openTruncate(out)
	if err != nil {
		return err
	}
	defer w.Close()
	buf := bytes.NewReader([]byte(panel.Content))
	return TransformReader(buf, "", cti, w)
}
