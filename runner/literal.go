package runner

import "bytes"

func (ec EvalContext) evalLiteralPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	cti := panel.Literal.ContentTypeInfo
	out := ec.GetPanelResultsFile(project.Id, panel.Id)
	w, closeFile, err := openTruncateBufio(out)
	if err != nil {
		return err
	}
	defer closeFile()
	defer w.Flush()

	buf := bytes.NewReader([]byte(panel.Content))
	br := newBufferedReader(buf)

	return TransformReader(br, "", cti, w)
}
