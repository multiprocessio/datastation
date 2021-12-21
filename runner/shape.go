package runner

import "encoding/json"

type ShapeKind string

const (
	ScalarKind  ShapeKind = "scalar"
	UnknownKind           = "unknown"
	ObjectKind            = "object"
	ArrayKind             = "array"
	VariedKind            = "varied"
)

type Shape struct {
	Kind ShapeKind `json:"kind"`
	*ScalarShape
	*ObjectShape
	*ArrayShape
	*VariedShape
}

func (s *Shape) UnmarshalJSON(data []byte) error {
	var m map[string]interface{}
	err := json.Unmarshal(data, &m)
	if err != nil {
		return err
	}

	k, ok := m["kind"]
	if !ok {
		return edsef(`Missing required key: "kind"`)
	}

	ks, ok := k.(string)
	if !ok {
		return edsef(`Invalid kind, expected string got: "%v"`, k)
	}

	s.Kind = ShapeKind(ks)
	switch s.Kind {
	case ArrayKind:
		s.ArrayShape = new(ArrayShape)
		return json.Unmarshal(data, s.ArrayShape)
	case VariedKind:
		s.VariedShape = new(VariedShape)
		return json.Unmarshal(data, s.VariedShape)
	case ObjectKind:
		s.ObjectShape = new(ObjectShape)
		return json.Unmarshal(data, s.ObjectShape)
	case ScalarKind:
		s.ScalarShape = new(ScalarShape)
		return json.Unmarshal(data, s.ScalarShape)
	case UnknownKind:
		return nil
	}

	return edsef(`Invalid kind: "%s"`, ks)
}

type ScalarName string

const (
	NullScalar    ScalarName = "null"
	StringScalar             = "string"
	NumberScalar             = "number"
	BooleanScalar            = "boolean"
	BigintScalar             = "bigint"
)

type ScalarShape struct {
	Name ScalarName `json:"name"`
}

type ObjectShape struct {
	Children map[string]Shape `json:"children"`
}

type ArrayShape struct {
	Children Shape `json:"children"`
}

type VariedShape struct {
	Children []Shape `json:"children"`
}

var unknownShape = Shape{Kind: UnknownKind}
var defaultShape = unknownShape

func GetArrayShape(id string, raw []map[string]interface{}, sampleSize int) (*Shape, error) {
	if raw == nil {
		return nil, makeErrNotAnArrayOfObjects(id)
	}

	obj := ObjectShape{
		Children: map[string]Shape{},
	}

	for i, row := range raw {
		if i > sampleSize {
			break
		}

		for key, val := range row {
			var name ScalarName = StringScalar
			switch t := val.(type) {
			case int, int64, float64, float32, int32, int16, int8, uint, uint64, uint32, uint8, uint16:
				name = NumberScalar
			case bool:
				name = BooleanScalar
			case string, []byte:
				name = StringScalar
			default:
				Logln("Skipping unknown type: %s", t)
				continue
			}

			// Downgrade anything with multiple types to string
			if shape, set := obj.Children[key]; set && shape.ScalarShape.Name != name {
				name = StringScalar
			}

			obj.Children[key] = Shape{
				Kind: ScalarKind,
				ScalarShape: &ScalarShape{
					Name: name,
				},
			}
		}
	}

	return &Shape{
		Kind: ArrayKind,
		ArrayShape: &ArrayShape{
			Children: Shape{
				Kind:        ObjectKind,
				ObjectShape: &obj,
			},
		},
	}, nil
}
