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
	bb := bufio.NewReaderSize(buf, 4096*20)

	b := bufio.NewWriterSize(w, 4096*20)
	defer b.Flush()

	return TransformReader(bb, "", cti, b)
}
