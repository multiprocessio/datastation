package runner

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetShape(t *testing.T) {
	tests := []struct {
		json     string
		expShape Shape
	}{
		{
			`{"a": 1}`,
			Shape{
				Kind: ObjectKind,
				ObjectShape: &ObjectShape{
					Children: map[string]Shape{
						"a": {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
					},
				},
			},
		},
		{
			`[{"a": 1}, {"a": "2"}, {"a": 1}]`,
			Shape{
				Kind: ArrayKind,
				ArrayShape: &ArrayShape{
					Children: Shape{
						Kind: ObjectKind,
						ObjectShape: &ObjectShape{
							Children: map[string]Shape{
								"a": {
									Kind: VariedKind,
									VariedShape: &VariedShape{
										Children: []Shape{
											{Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
											{Kind: ScalarKind, ScalarShape: &ScalarShape{Name: StringScalar}},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			`[{"a": 1}, {"b": 3}]`,
			Shape{
				Kind: ArrayKind,
				ArrayShape: &ArrayShape{
					Children: Shape{
						Kind: ObjectKind,
						ObjectShape: &ObjectShape{
							Children: map[string]Shape{
								"a": {
									Kind: VariedKind,
									VariedShape: &VariedShape{
										Children: []Shape{
											{Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
											NullShape,
										},
									},
								},
								"b": {
									Kind: VariedKind,
									VariedShape: &VariedShape{
										Children: []Shape{
											{Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
											NullShape,
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			`[{"a": "9"}, {"a": "2"}, {"a": 1}]`,
			Shape{
				Kind: ArrayKind,
				ArrayShape: &ArrayShape{
					Children: Shape{
						Kind: ObjectKind,
						ObjectShape: &ObjectShape{
							Children: map[string]Shape{
								"a": {
									Kind: VariedKind,
									VariedShape: &VariedShape{
										Children: []Shape{
											{Kind: ScalarKind, ScalarShape: &ScalarShape{Name: StringScalar}},
											{Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			`[{"a": "9", "b": 1}, {"a": "2", "b": 2}, {"a": 1, "b": 3}]`,
			Shape{
				Kind: ArrayKind,
				ArrayShape: &ArrayShape{
					Children: Shape{
						Kind: ObjectKind,
						ObjectShape: &ObjectShape{
							Children: map[string]Shape{
								"a": {
									Kind: VariedKind,
									VariedShape: &VariedShape{
										Children: []Shape{
											{Kind: ScalarKind, ScalarShape: &ScalarShape{Name: StringScalar}},
											{Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
										},
									},
								},
								"b": {
									Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar},
								},
							},
						},
					},
				},
			},
		},
		{
			`[{"a": {"b": 1}, "c": "2"}]`,
			Shape{
				Kind: ArrayKind,
				ArrayShape: &ArrayShape{
					Children: Shape{
						Kind: ObjectKind,
						ObjectShape: &ObjectShape{
							Children: map[string]Shape{
								"a": {
									Kind: ObjectKind,
									ObjectShape: &ObjectShape{
										Children: map[string]Shape{
											"b": {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
										},
									},
								},
								"c": {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: StringScalar}},
							},
						},
					},
				},
			},
		},
		{
			`[{"a": {"b": 1}, "d": [], "c": "2"}]`,
			Shape{
				Kind: ArrayKind,
				ArrayShape: &ArrayShape{
					Children: Shape{
						Kind: ObjectKind,
						ObjectShape: &ObjectShape{
							Children: map[string]Shape{
								"a": {
									Kind: ObjectKind,
									ObjectShape: &ObjectShape{
										Children: map[string]Shape{
											"b": {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: NumberScalar}},
										},
									},
								},
								"c": {Kind: ScalarKind, ScalarShape: &ScalarShape{Name: StringScalar}},
								"d": {Kind: ArrayKind, ArrayShape: &ArrayShape{Children: UnknownShape}},
							},
						},
					},
				},
			},
		},
	}

	for _, test := range tests {
		var j any
		err := json.Unmarshal([]byte(test.json), &j)
		assert.Nil(t, err)
		fmt.Println(j)
		s := GetShape("", j, 50)
		assert.Nil(t, err)
		assert.Equal(t, s, test.expShape)
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

func TestShapePathIsObjectArray(t *testing.T) {
	makeString := func(s string) *string {
		return &s
	}
	tests := []struct {
		json             string
		path             string
		expErrContains   *string
		expIsObjectArray bool
	}{
		{
			`{"a": 1}`,
			"b",
			makeString("Path does not exist"),
			false,
		},
		{
			`{"a": 1}`,
			"a",
			nil,
			false,
		},
		{
			`1`,
			"b",
			makeString("Path enters non-object"),
			false,
		},
		{
			`{"a": []}`,
			"a",
			nil,
			false,
		},
		{
			`{"a": [1, 2]}`,
			"a",
			nil,
			false,
		},
		{
			`{"a": [{"b": 1}, {"c": 2}]}`,
			"a",
			nil,
			true,
		},
		{
			`{"d": {"a": [{"b": 1}, {"c": 2}]}}`,
			"d.a",
			nil,
			true,
		},
		{
			`{".d": {"a": [{"b": 1}, {"c": 2}]}}`,
			"\\.d.a",
			nil,
			true,
		},
		{
			`[{"a": 2}, {"b": 3}]`,
			"",
			nil,
			true,
		},
	}

	for _, test := range tests {
		var j any
		err := json.Unmarshal([]byte(test.json), &j)
		assert.Nil(t, err)
		s := GetShape("", j, len(test.json))
		assert.Nil(t, err)

		sp, err := shapeAtPath(s, test.path)
		if test.expErrContains == nil {
			assert.Nil(t, err)
		} else {
			assert.True(t, strings.Contains(err.Error(), *test.expErrContains))
		}
		if test.expIsObjectArray {
			ok := ShapeIsObjectArray(*sp)
			assert.True(t, ok)
		}
	}
}

func TestShape_MarshalJSON(t *testing.T) {
	tests := []struct{
		data string
		shapeJson string
	}{
		{
			`[1, "a"]`,
			`{"kind": "array", "array": {"kind": "varied", "varied": [{"kind": "scalar", "scalar": "number"},{"kind": "scalar", "scalar": "string"}]}}`,
		},
		{
			`[{"a": 1}, {"a": 2}]`,
			`{"kind": "array", "array": {"kind": "object", "object": {"a": {"kind": "scalar", "scalar": "number"}}}}`,
		},
	}
	for _, test := range tests {
		var j any
		err := json.Unmarshal([]byte(test.data), &j)
		assert.Nil(t, err)
		s := GetShape("", j, len(test.data))

		bs, err := s.MarshalJSON()
		assert.Nil(t, err)
		assert.Equal(t, test.shapeJson, string(bs))
	}
}

func TestShape_Pretty(t *testing.T) {
	tests := []struct{
		data string
		pretty string
	}{
		{
			`[1, "a"]`,
			`Array of
  Varied of
    number or
    string`,
		},
		{
			`[{"a": 1}, {"a": 2}]`,
			`Array of
  Object of
    a of
      number`,
		},
		{
			`{"a": {"b": 2, "c": {"d": "flubber"}}}`,
			`Object of
  a of
    Object of
      b of
        number
      c of
        Object of
          d of
            string`,
		},
	}
	for _, test := range tests {
		var j any
		err := json.Unmarshal([]byte(test.data), &j)
		assert.Nil(t, err)
		s := GetShape("", j, len(test.data))

		p := s.Pretty("")
		assert.Nil(t, err)
		assert.Equal(t, test.pretty, p)
	}
}
