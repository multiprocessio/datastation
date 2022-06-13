package runner

import "bytes"

func (ec EvalContext) evalLiteralPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	cti := panel.Literal.ContentTypeInfo

	rw, err := ec.GetResultWriter(project.Id, panel.Id)
	if err != nil {
		return err
	}
	defer rw.Close()

	buf := bytes.NewReader([]byte(panel.Content))
	br := newBufferedReader(buf)

	return TransformReader(br, "", cti, rw)
}
