package runner

import (
	"io/ioutil"
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetShape(t *testing.T) {
	tests := []struct{
		json string
		expShape Shape
	}{
		{
			`[{"a": {"b": 1}, "c": "2"}]`,
			Shape{
				Kind: ObjectKind,
				ObjectShape: &ObjectShape{
					Children: map[string]Shape{
						"a": Shape{
							Kind: ObjectKind,
							ObjectShape: &ObjectShape{
								Children: map[string]Shape{
									"b":    {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: StringScalar}},
								},
							},
						},
						"c":    {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: StringScalar}},
					},
				},
			},
		},
		{
			`[{"a": {"b": 1}, "d": [], "c": "2"}]`,
			Shape{
				Kind: ObjectKind,
				ObjectShape: &ObjectShape{
					Children: map[string]Shape{
						"a": Shape{
							Kind: ObjectKind,
							ObjectShape: &ObjectShape{
								Children: map[string]Shape{
									"b":    {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: StringScalar}},
								},
							},
						},
						"c":    {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: StringScalar}},
					},
				},
			},
		},
	}

	for _, test := range tests {
		var j []interface{}
		err := json.Unmarshal([]byte(test.json), &j)
		assert.Nil(t, err)
		fmt.Println(j)
		s, err := GetShape("", j, 50)
		assert.Nil(t, err)
		assert.Equal(t, *s, test.expShape)
	}
}

func TestShapeFromFile(t *testing.T) {
	tests := []struct {
		json        string
		bytesToRead int
		expShape    *Shape
		expErr      error
	}{
		{
			`[{"a": 1, "b ] ": 2}, {"a": 2, "b ] ": 3}]`,
			200,
			&Shape{
				Kind: ArrayKind,
				ArrayShape: &ArrayShape{
					Children: Shape{
						Kind: ObjectKind,
						ObjectShape: &ObjectShape{
							Children: map[string]Shape{
								"a":    {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
								"b ] ": {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
							},
						},
					},
				},
			},
			nil,
		},
		{
			`[{"a": 1, "b \" ": 2}, {"a": 2, "b \" ": 3}]`,
			200,
			&Shape{
				Kind: ArrayKind,
				ArrayShape: &ArrayShape{
					Children: Shape{
						Kind: ObjectKind,
						ObjectShape: &ObjectShape{
							Children: map[string]Shape{
								"a":     {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
								"b \" ": {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
							},
						},
					},
				},
			},
			nil,
		},
		{
			`[{"a": 1, "b": 2}, {"a": 2, "b": 3}]`,
			200,
			&Shape{
				Kind: ArrayKind,
				ArrayShape: &ArrayShape{
					Children: Shape{
						Kind: ObjectKind,
						ObjectShape: &ObjectShape{
							Children: map[string]Shape{
								"a": {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
								"b": {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
							},
						},
					},
				},
			},
			nil,
		},
		{
			`[{"a": 1, "b": "y"}, {"a": 2, "b": "x"}]`,
			200,
			&Shape{
				Kind: ArrayKind,
				ArrayShape: &ArrayShape{
					Children: Shape{
						Kind: ObjectKind,
						ObjectShape: &ObjectShape{
							Children: map[string]Shape{
								"a": {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
								"b": {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: StringScalar}},
							},
						},
					},
				},
			},
			nil,
		},
		{
			`[{"a": 1, "b": "y"}, {"c": 2, "d": "x"}]`,
			8,
			&Shape{
				Kind: ArrayKind,
				ArrayShape: &ArrayShape{
					Children: Shape{
						Kind: ObjectKind,
						ObjectShape: &ObjectShape{
							Children: map[string]Shape{
								"a": {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
								"b": {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: StringScalar}},
							},
						},
					},
				},
			},
			nil,
		},
	}

	for _, test := range tests {
		// Wrap in an instant function so that `defer remove` gets called
		func() {
			tmp, err := ioutil.TempFile("", "")
			defer os.Remove(tmp.Name())
			assert.Nil(t, err)

			tmp.WriteString(test.json)

			s, err := ShapeFromFile(tmp.Name(), "x", test.bytesToRead, 50)
			assert.Equal(t, test.expErr, err)
			assert.Equal(t, test.expShape, s)
		}()
	}

}
