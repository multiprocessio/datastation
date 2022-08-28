package runner

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_transformCSV_literal(t *testing.T) {
	tests := []struct {
		in  string
		out []map[string]any
	}{
		{
			`name,age
ted,10
elsa,12`,
			[]map[string]any{
				{"name": "ted", "age": "10"},
				{"name": "elsa", "age": "12"},
			},
		},
	}

	ec, cleanup := makeTestEvalContext()
	defer cleanup()

	projectTmp, err := os.CreateTemp("", "dsq-project")
	assert.Nil(t, err)
	defer os.Remove(projectTmp.Name())

	project := &ProjectState{
		Id: projectTmp.Name(),
		Pages: []ProjectPage{
			{
				Panels: []PanelInfo{{
					Id:   newId(),
					Type: LiteralPanel,
					LiteralPanelInfo: &LiteralPanelInfo{
						Literal: LiteralPanelInfoLiteral{
							ContentTypeInfo: ContentTypeInfo{
								Type: "text/csv",
							},
						},
					},
				}},
			},
		},
	}

	for _, test := range tests {
		project.Pages[0].Panels[0].Content = test.in

		err = ec.evalLiteralPanel(project, 0, &project.Pages[0].Panels[0])
		assert.Nil(t, err)

		var m []map[string]any
		out := ec.GetPanelResultsFile(project.Id, project.Pages[0].Panels[0].Id)
		outTmpBs, err := os.ReadFile(out)
		assert.Nil(t, err)
		err = jsonUnmarshal(outTmpBs, &m)
		assert.Nil(t, err)

		assert.Equal(t, test.out, m)
	}
}
