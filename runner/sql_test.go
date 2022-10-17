package runner

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
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
	panels, query, path, err := transformDM_getPanelCalls(
		"SELECT * FROM DM_getPanel(0) p0, DM_getPanel('my great panel')",
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
		false,
	)

	assert.Nil(t, err)
	assert.Equal(t, query, `SELECT * FROM "t_0" p0, "t_my great panel"`)
	assert.Equal(t, len(panels), 2)
	assert.Equal(t, path, "")
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

func Test_transformDM_getPanel_callsWithPaths(t *testing.T) {
	tests := []struct {
		data       string
		query      string
		expColumns []column
		expPath    string
	}{

		{
			`{"a": [{"b": 2}, {"c": 3}]}`,
			`SELECT * FROM DM_getPanel(0, "a")`,
			[]column{
				{name: "b", kind: "REAL"},
				{name: "c", kind: "REAL"},
			},
			"a",
		},
		{
			`{"a": [{"b": 2}, {"c": 3}]}`,
			"SELECT * FROM DM_getPanel(0, 'a')",
			[]column{
				{name: "b", kind: "REAL"},
				{name: "c", kind: "REAL"},
			},
			"a",
		},
		{
			`[{"b": 2}, {"c": 3}]`,
			"SELECT * FROM DM_getPanel(0)",
			[]column{
				{name: "b", kind: "REAL"},
				{name: "c", kind: "REAL"},
			},
			"",
		},
	}

	for _, test := range tests {
		var j any
		err := json.Unmarshal([]byte(test.data), &j)
		assert.Nil(t, err)
		s := GetShape("", j, len(test.data))
		assert.Nil(t, err)

		panels, query, path, err := transformDM_getPanelCalls(
			test.query,
			map[string]Shape{"0": s},
			map[string]string{"0": " a great id 2"},
			true,
			quoteType{identifier: "\""},
			false,
		)

		assert.Nil(t, err)
		assert.Equal(t, query, `SELECT * FROM "t_0"`)
		assert.Equal(t, len(panels), 1)
		assert.Equal(t, test.expPath, path)
		assert.Equal(t, panels[0], panelToImport{
			tableName: "t_0",
			columns:   test.expColumns,
			id:        " a great id 2",
		})
	}
}

func Test_postgresMangleInsert(t *testing.T) {
	assert.Equal(t,
		postgresMangleInsert("INSERT INTO x VALUES (?, ?, ?)"),
		"INSERT INTO x VALUES ($1, $2, $3)")
}

func Test_GetObjectAtPath(t *testing.T) {
	tests := []struct {
		input    map[string]any
		path     string
		expected any
	}{
		{
			map[string]any{
				"x": 1,
			},
			"x",
			1,
		},
		{
			map[string]any{
				"x.y": 3,
			},
			"x.y",
			3,
		},
		{
			map[string]any{
				"x": map[string]any{
					"y": 4,
				},
			},
			"x.y",
			4,
		},
		{
			map[string]any{
				"x.z": map[string]any{
					"y": 6,
				},
			},
			"x\\.z.y",
			6,
		},
		{
			map[string]any{
				"x.z": map[string]any{
					"y": map[string]any{
						"z": "19",
					},
				},
			},
			"x\\.z.y.z",
			"19",
		},
	}

	for _, test := range tests {
		res := GetObjectAtPath(test.input, test.path)
		assert.Equal(t, test.expected, res)
	}
}

func makeTestEvalContext() (EvalContext, func()) {
	f, _ := os.MkdirTemp("", "datastation-unittest-space")

	ec := NewEvalContext(*DefaultSettings, f)
	return ec, func() {
		os.Remove(f)
	}
}

func Test_sqlIngest_e2e(t *testing.T) {
	tests := []struct {
		json      string
		sql       string
		expResult []any
	}{
		{
			`[{"a": 1},{"b": 2}]`,
			"SELECT * FROM DM_getPanel(0) ORDER BY a DESC",
			[]any{
				map[string]any{"a": float64(1), "b": nil},
				map[string]any{"a": nil, "b": float64(2)},
			},
		},
		{
			`[{"a": 1},{"b": 2}, {"a": 1},{"b": 2}, {"a": 1},{"b": 2}, {"a": 1},{"b": 2}, {"a": 1},{"b": 2}]`,
			"SELECT * FROM DM_getPanel(0) ORDER BY a DESC",
			[]any{
				map[string]any{"a": float64(1), "b": nil},
				map[string]any{"a": float64(1), "b": nil},
				map[string]any{"a": float64(1), "b": nil},
				map[string]any{"a": float64(1), "b": nil},
				map[string]any{"a": float64(1), "b": nil},
				map[string]any{"a": nil, "b": float64(2)},
				map[string]any{"a": nil, "b": float64(2)},
				map[string]any{"a": nil, "b": float64(2)},
				map[string]any{"a": nil, "b": float64(2)},
				map[string]any{"a": nil, "b": float64(2)},
			},
		},
		{
			`[{"a": 1},{"b": 2}, {"a": 1},{"b": 2}, {"a": 1},{"b": 2}, {"a": 1},{"b": 2}, {"a": 1},{"b": 2},{"b": 2}]`,
			"SELECT * FROM DM_getPanel(0) ORDER BY a DESC",
			[]any{
				map[string]any{"a": float64(1), "b": nil},
				map[string]any{"a": float64(1), "b": nil},
				map[string]any{"a": float64(1), "b": nil},
				map[string]any{"a": float64(1), "b": nil},
				map[string]any{"a": float64(1), "b": nil},
				map[string]any{"a": nil, "b": float64(2)},
				map[string]any{"a": nil, "b": float64(2)},
				map[string]any{"a": nil, "b": float64(2)},
				map[string]any{"a": nil, "b": float64(2)},
				map[string]any{"a": nil, "b": float64(2)},
				map[string]any{"a": nil, "b": float64(2)},
			},
		},
		{
			`[{"a": 1},{"b": 2},{"c": [1]}]`,
			"SELECT * FROM DM_getPanel(0) ORDER BY a DESC",
			[]any{
				map[string]any{"a": float64(1), "b": nil, "c": nil},
				map[string]any{"a": nil, "b": float64(2), "c": nil},
				map[string]any{"a": nil, "b": nil, "c": "[1]"},
			},
		},
		{
			`[{"a": 1,"b": 2,"c": [1]}]`,
			"SELECT * FROM DM_getPanel(0) ORDER BY a DESC",
			[]any{
				map[string]any{"a": float64(1), "b": float64(2), "c": "[1]"},
			},
		},
		{
			`{"data":{"data1":[{"id":1,"name":"Corah"},{"id":3,"name":"Minh"}],"data2":[{"id":2,"name":"Corah"},{"id":4,"name":"Minh"}]},"total":2}`,
			"SELECT * FROM DM_getPanel(0, 'data.data2') ORDER BY id DESC",
			[]any{
				map[string]any{"id": float64(4), "name": "Minh"},
				map[string]any{"id": float64(2), "name": "Corah"},
			},
		},
	}

	projectTmp, err := os.CreateTemp("", "dsq-project")
	assert.Nil(t, err)
	defer os.Remove(projectTmp.Name())

	ec, cleanup := makeTestEvalContext()
	defer cleanup()

	for _, test := range tests {
		project := &ProjectState{
			Id: projectTmp.Name(),
			Pages: []ProjectPage{
				{
					Panels: nil,
				},
			},
		}

		connector, err := MakeTmpSQLiteConnector()
		assert.Nil(t, err)
		project.Connectors = append(project.Connectors, *connector)

		readFile, err := os.CreateTemp("", "infile")
		assert.Nil(t, err)
		defer os.Remove(readFile.Name())

		_, err = readFile.WriteString(test.json)
		assert.Nil(t, err)

		panelId := newId()
		s, err := ShapeFromFile(readFile.Name(), panelId, 10_000, 100)
		assert.Nil(t, err)
		project.Pages[0].Panels = append(project.Pages[0].Panels, PanelInfo{
			ResultMeta: PanelResult{
				Shape: *s,
			},
			Id:   panelId,
			Name: newId(),
		})

		panel2 := &PanelInfo{
			Type:    DatabasePanel,
			Content: test.sql,
			Id:      newId(),
			Name:    newId(),
			DatabasePanelInfo: &DatabasePanelInfo{
				Database: DatabasePanelInfoDatabase{
					ConnectorId: connector.Id,
				},
			},
		}

		err = ec.EvalDatabasePanel(project, 0, panel2, func(projectId, panelId string) (chan map[string]any, error) {
			return loadJSONArrayFileWithPath(readFile.Name(), ec.path)
		}, *DefaultCacheSettings)
		if err != nil {
			// Otherwise the channel below gets weird to debug
			panic(err)
		}

		f := ec.GetPanelResultsFile(project.Id, panel2.Id)
		a, err := loadJSONArrayFile(f)
		var pieces []any
		for r := range a {
			pieces = append(pieces, r)
		}
		assert.Nil(t, err)
		assert.Equal(t, test.expResult, pieces)
	}
}

// BENCHMARKS

func Test_sqlIngest_BENCHMARK(t *testing.T) {
	if os.Getenv("BENCHMARK") != "true" {
		return
	}

	projectTmp, err := os.CreateTemp("", "dsq-project")
	assert.Nil(t, err)
	defer os.Remove(projectTmp.Name())

	project := &ProjectState{
		Id: projectTmp.Name(),
		Pages: []ProjectPage{
			{
				Panels: nil,
			},
		},
	}

	connector, err := MakeTmpSQLiteConnector()
	assert.Nil(t, err)
	project.Connectors = append(project.Connectors, *connector)

	// curl -LO https://s3.amazonaws.com/nyc-tlc/trip+data/yellow_tripdata_2021-04.csv
	// dsq yellow_tripdata_2021-04.csv > taxi.json
	readFile := "taxi.json"

	panelId := newId()
	s, err := ShapeFromFile(readFile, panelId, 10_000, 100)
	assert.Nil(t, err)
	project.Pages[0].Panels = append(project.Pages[0].Panels, PanelInfo{
		ResultMeta: PanelResult{
			Shape: *s,
		},
		Id:   panelId,
		Name: newId(),
	})

	panel2 := &PanelInfo{
		Type:    DatabasePanel,
		Content: "SELECT COUNT(1) FROM DM_getPanel(0)",
		Id:      newId(),
		Name:    newId(),
		DatabasePanelInfo: &DatabasePanelInfo{
			Database: DatabasePanelInfoDatabase{
				ConnectorId: connector.Id,
			},
		},
	}

	ec := EvalContext{}
	err = ec.EvalDatabasePanel(project, 0, panel2, func(projectId, panelId string) (chan map[string]any, error) {
		return loadJSONArrayFileWithPath(readFile, ec.path)
	}, *DefaultCacheSettings)
	assert.Nil(t, err)
}
