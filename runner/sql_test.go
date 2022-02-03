package runner

import (
	"io/ioutil"
	"os"
	"testing"

	"github.com/google/uuid"
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

// func Test_chunk(t *testing.T) {
// 	a := []map[string]interface{}{
// 		{"a": 1},
// 		{"b": 2},
// 		{"c": 3},
// 		{"d": 4},
// 		{"e": 5},
// 		{"f": 6},
// 		{"g": 7},
// 	}
// 	chunks := chunk(a, 3)
// 	assert.Equal(t, len(chunks), 3)
// 	assert.Equal(t, len(chunks[0]), 3)
// 	assert.Equal(t, len(chunks[1]), 3)
// 	assert.Equal(t, len(chunks[2]), 1)
// 	assert.Equal(t, chunks[2][0], map[string]interface{}{
// 		"g": 7,
// 	})
// }

func Test_postgresMangleInsert(t *testing.T) {
	assert.Equal(t,
		postgresMangleInsert("INSERT INTO x VALUES (?, ?, ?)"),
		"INSERT INTO x VALUES ($1, $2, $3)")
}

func Test_getObjectAtPath(t *testing.T) {
	tests := []struct {
		input    map[string]interface{}
		path     string
		expected interface{}
	}{
		{
			map[string]interface{}{
				"x": 1,
			},
			"x",
			1,
		},
		{
			map[string]interface{}{
				"x.y": 3,
			},
			"x.y",
			3,
		},
		{
			map[string]interface{}{
				"x": map[string]interface{}{
					"y": 4,
				},
			},
			"x.y",
			4,
		},
		{
			map[string]interface{}{
				"x.z": map[string]interface{}{
					"y": 6,
				},
			},
			"x\\.z.y",
			6,
		},
		{
			map[string]interface{}{
				"x.z": map[string]interface{}{
					"y": map[string]interface{}{
						"z": "19",
					},
				},
			},
			"x\\.z.y.z",
			"19",
		},
	}

	for _, test := range tests {
		res := getObjectAtPath(test.input, test.path)
		assert.Equal(t, test.expected, res)
	}
}

func Test_sqlIngest_BENCHMARK(t *testing.T) {
	if os.Getenv("BENCHMARK") != "true" {
		return
	}

	projectTmp, err := ioutil.TempFile("", "dsq-project")
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

	connector, tmp, err := MakeTmpSQLiteConnector()
	assert.Nil(t, err)
	defer os.Remove(tmp.Name())
	project.Connectors = append(project.Connectors, *connector)

	// curl -LO https://s3.amazonaws.com/nyc-tlc/trip+data/yellow_tripdata_2021-04.csv
	// dsq yellow_tripdata_2021-04.csv > yellow_tripdata_2021-04.json
	readFile := "yellow_tripdata_2021-04.json"
	//readFile := "../testdata/allformats/userdata.json"

	panelId := uuid.New().String()
	s, err := ShapeFromFile(readFile, panelId, 10_000, 100)
	assert.Nil(t, err)
	project.Pages[0].Panels = append(project.Pages[0].Panels, PanelInfo{
		ResultMeta: PanelResult{
			Shape: *s,
		},
		Id:   panelId,
		Name: uuid.New().String(),
	})

	panel2 := &PanelInfo{
		Type:    DatabasePanel,
		Content: "SELECT COUNT(1) FROM DM_getPanel(0)",
		Id:      uuid.New().String(),
		Name:    uuid.New().String(),
		DatabasePanelInfo: &DatabasePanelInfo{
			Database: DatabasePanelInfoDatabase{
				ConnectorId: connector.Id,
			},
		},
	}

	err = EvalDatabasePanel(project, 0, panel2, func(projectId, panelId string) (chan map[string]interface{}, error) {
		return loadJSONArrayFile(readFile)
	})
	assert.Nil(t, err)
}
