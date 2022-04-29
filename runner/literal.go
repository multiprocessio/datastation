package runner

import (
	"bufio"
	"bytes"
)

func (ec EvalContext) evalLiteralPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	cti := panel.Literal.ContentTypeInfo
	out := ec.GetPanelResultsFile(project.Id, panel.Id)
	w, err := openTruncate(out)
	if err != nil {
		return err
	}
	defer w.Close()
	buf := bytes.NewReader([]byte(panel.Content))

	b := bufio.NewWriter(w)
	defer b.Flush()

	return TransformReader(buf, "", cti, b)
}
