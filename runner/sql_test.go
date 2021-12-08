package main

import (
	"github.com/stretchr/testify/assert"
	"testing"
)

func Test_transformDM_getPanelCalls(t *testing.T) {
	shape := Shape{
		Kind: ArrayKind,
		ArrayShape: &ArrayShape{
			Children: Shape{
				Kind: ObjectKind,
				ObjectShape: &ObjectShape{
					Children: map[string]Shape{
						"age": {
							Kind: ScalarKind,
							ScalarShape: &ScalarShape{
								Name: NumberScalar,
							},
						},
						"name": {
							Kind: ScalarKind,
							ScalarShape: &ScalarShape{
								Name: StringScalar,
							},
						},
					},
				},
			},
		},
	}
	panels, query, err := transformDM_getPanelCalls(
		"SELECT * FROM DM_getPanel(0), DM_getPanel('my great panel')",
		map[string]Shape{
			"0":              shape,
			"my great panel": shape,
		},
		map[string]string{
			"0":              " a great id 2",
			"my great panel": " a great id",
		},
		true,
		quoteType{
			identifier: "\"",
		},
	)

	assert.Nil(t, err)
	assert.Equal(t, query, `SELECT * FROM "t_0", "t_my great panel"`)
	assert.Equal(t, len(panels), 2)
	assert.Equal(t, panels[0], panelToImport{
		tableName: "t_0",
		columns: []column{
			{
				kind: "REAL",
				name: "age",
			},
			{
				kind: "TEXT",
				name: "name",
			},
		},
		id: " a great id 2",
	})
	assert.Equal(t, panels[1], panelToImport{
		tableName: "t_my great panel",
		columns: []column{
			{
				kind: "REAL",
				name: "age",
			},
			{
				kind: "TEXT",
				name: "name",
			},
		},
		id: " a great id",
	})
}
