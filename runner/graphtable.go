package runner

import (
	jsonutil "github.com/multiprocessio/go-json"
)

func (ec EvalContext) getResultColumns(project *ProjectState, thisId, panelSourceId string, columns []string, page, pageSize int) error {
	var panelSource *PanelInfo
outer:
	for _, page := range project.Pages {
		for _, panel := range page.Panels {
			p := panel
			if panel.Id == panelSourceId {
				panelSource = &p
				break outer
			}
		}
	}

	if panelSource == nil {
		return makeErrInvalidDependentPanel(panelSourceId)
	}

	if !ShapeIsObjectArray(panelSource.ResultMeta.Shape) {
		return makeErrNotAnArrayOfObjects(panelSource.Name)
	}

	resultFile := ec.GetPanelResultsFile(project.Id, panelSourceId)

	rows, err := loadJSONArrayFile(resultFile)
	if err != nil {
		return err
	}
	i := 0

	outFile := ec.GetPanelResultsFile(project.Id, thisId)
	out, closeFile, err := openTruncateBufio(outFile)
	if err != nil {
		return err
	}

	defer closeFile()
	defer out.Flush()

	rowMap := map[string]any{}
	return withJSONArrayOutWriter(out, func(w *jsonutil.StreamEncoder) error {
		for {
			row := <-rows
			if row == nil {
				return nil
			}

			if i >= page*pageSize {
				if i == (page+1)*pageSize {
					// Break as soon as possible
					return nil
				}

				for _, c := range columns {
					rowMap[c] = getObjectAtPath(row, c)
				}
				err := w.EncodeRow(rowMap)
				if err != nil {
					return err
				}
			}

			i++
		}

		return nil
	})
}

func (ec EvalContext) evalTablePanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	var columns []string
	for _, col := range panel.Table.Columns {
		columns = append(columns, col.Field)
	}

	if panel.PageSize == 0 {
		panel.PageSize = 15
	}
	return ec.getResultColumns(project, panel.Id, panel.Table.PanelSource, columns, panel.Page, panel.PageSize)
}

func (ec EvalContext) evalGraphPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	columns := []string{panel.Graph.X}
	for _, col := range panel.Graph.Ys {
		columns = append(columns, col.Field)
	}

	if panel.PageSize == 0 {
		panel.PageSize = 10_000
	}
	return ec.getResultColumns(project, panel.Id, panel.Graph.PanelSource, columns, panel.Page, panel.PageSize)
}
