package runner

import (
	"io/ioutil"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

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
