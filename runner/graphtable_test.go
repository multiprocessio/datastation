package runner

import (
	"io/ioutil"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_evalGraphTable(t *testing.T) {
	tests := []struct {
		in           string
		tableOrGraph PanelInfo
		out          []map[string]any
	}{
		{
			`name,age
ted,10
elsa,12`,
			PanelInfo{
				Id:   newId(),
				Type: TablePanel,
				TablePanelInfo: &TablePanelInfo{
					Table: TablePanelInfoTable{
						Columns: []TableColumn{
							{Field: "name"},
						},
					},
				},
			},
			[]map[string]any{
				{"name": "ted"},
				{"name": "elsa"},
			},
		},
		{
			`name,age
ted,10
elsa,12`,
			PanelInfo{
				Id:   newId(),
				Type: TablePanel,
				TablePanelInfo: &TablePanelInfo{
					Table: TablePanelInfoTable{
						Columns: []TableColumn{
							{Field: "name"},
						},
					},
				},
				Page:     0,
				PageSize: 1,
			},
			[]map[string]any{
				{"name": "ted"},
			},
		},
		{
			`name,age
ted,10
elsa,12`,
			PanelInfo{
				Id:   newId(),
				Type: TablePanel,
				TablePanelInfo: &TablePanelInfo{
					Table: TablePanelInfoTable{
						Columns: []TableColumn{
							{Field: "name"},
						},
					},
				},
				Page:     1,
				PageSize: 1,
			},
			[]map[string]any{
				{"name": "elsa"},
			},
		},
		{
			`name,age
ted,10
elsa,12`,
			PanelInfo{
				Id:   newId(),
				Type: GraphPanel,
				GraphPanelInfo: &GraphPanelInfo{
					Graph: GraphPanelInfoGraph{
						X: "name",
						Ys: []TableColumn{
							{Field: "age"},
						},
					},
				},
			},
			[]map[string]any{
				{"name": "ted", "age": "10"},
				{"name": "elsa", "age": "12"},
			},
		},
	}

	ec, cleanup := makeTestEvalContext()
	defer cleanup()

	projectTmp, err := ioutil.TempFile("", "dsq-project")
	assert.Nil(t, err)
	defer os.Remove(projectTmp.Name())

	project := &ProjectState{
		Id: projectTmp.Name(),
		Pages: []ProjectPage{
			{
				Panels: []PanelInfo{
					{
						Id:   newId(),
						Type: LiteralPanel,
						LiteralPanelInfo: &LiteralPanelInfo{
							Literal: LiteralPanelInfoLiteral{
								ContentTypeInfo: ContentTypeInfo{
									Type: "text/csv",
								},
							},
						},
					},
					{},
				},
			},
		},
	}

	for _, test := range tests {
		project.Pages[0].Panels[0].Content = test.in
		project.Pages[0].Panels[1] = test.tableOrGraph

		err = ec.evalLiteralPanel(project, 0, &project.Pages[0].Panels[0])
		assert.Nil(t, err)

		project.Pages[0].Panels[0].ResultMeta.Shape = Shape{
			Kind: ArrayKind,
			ArrayShape: &ArrayShape{
				Children: Shape{
					Kind: ObjectKind,
					ObjectShape: &ObjectShape{
						Children: map[string]Shape{
							"name": {
								Kind:        ScalarKind,
								ScalarShape: &ScalarShape{Name: StringScalar},
							},
							"age": {
								Kind:        ScalarKind,
								ScalarShape: &ScalarShape{Name: NumberScalar},
							},
						},
					},
				},
			},
		}

		if test.tableOrGraph.Type == TablePanel {
			test.tableOrGraph.Table.PanelSource = project.Pages[0].Panels[0].Id
			err = ec.evalTablePanel(project, 0, &project.Pages[0].Panels[1])
		} else {
			test.tableOrGraph.Graph.PanelSource = project.Pages[0].Panels[0].Id
			err = ec.evalGraphPanel(project, 0, &project.Pages[0].Panels[1])
		}
		assert.Nil(t, err)

		var m []map[string]any
		out := ec.GetPanelResultsFile(project.Id, project.Pages[0].Panels[1].Id)
		outTmpBs, err := ioutil.ReadFile(out)
		assert.Nil(t, err)
		err = jsonUnmarshal(outTmpBs, &m)
		assert.Nil(t, err)

		assert.Equal(t, test.out, m)
	}
}
