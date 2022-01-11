package runner

import (
	"encoding/json"
	"os"
)

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

// TODO: support things that aren't arrays
func GetShape(id string, value interface{}, sampleSize int) (*Shape, error) {
	switch t := value.(type) {
	case []interface{}:
		var objects []map[string]interface{}
		for _, row := range t {
			switch tt := row.(type) {
			case map[string]interface{}:
				objects = append(objects, tt)
			default:
				return nil, makeErrNotAnArrayOfObjects(id)
			}
		}

		return GetArrayShape(id, objects, sampleSize)
	case []map[string]interface{}:
		return GetArrayShape(id, t, sampleSize)
	default:
		return nil, makeErrNotAnArrayOfObjects(id)
	}
}

const DefaultShapeMaxBytesToRead = 100_000

func ShapeFromFile(file, id string, maxBytesToRead int, sampleSize int) (*Shape, error) {
	fd, err := os.Open(file)
	if err != nil {
		return nil, edse(err)
	}

	stat, err := fd.Stat()
	if err != nil {
		return nil, edse(err)
	}

	size := stat.Size()

	if size < int64(maxBytesToRead) {
		var value interface{}
		decoder := json.NewDecoder(fd)
		err := decoder.Decode(&value)
		if err != nil {
			return nil, edse(err)
		}

		return GetShape(id, value, sampleSize)
	}

	done := false
	var f []byte
	var incomplete []byte
	inString := false

	for !done {
		buf := make([]byte, 1024)
		bytesRead, err := fd.Read(buf)
		if err != nil {
			return nil, edse(err)
		}

		read := buf[:bytesRead]
	outer:
		for i, c := range read {
			if c != '"' && inString {
				continue
			}

			switch c {
			case '"':
				var previous byte = ' '
				if i > 0 {
					previous = read[i-1]
				} else if len(f) > 0 {
					previous = f[len(f)-1]
				}

				isEscaped := previous == '\\'
				if !isEscaped {
					inString = !inString
				}
			case '{', '[':
				incomplete = append(incomplete, c)
			case ']', '}':
				if len(f)+len(read) >= maxBytesToRead {
					// Need to not count additional openings after this
					done = true
					read = read[:i]
					break outer
				}

				// Otherwise, pop it
				incomplete = incomplete[:len(incomplete)-1]
				break
			}
		}

		f = append(f, read...)
		if bytesRead < cap(buf) {
			break
		}
	}

	for i := len(incomplete) - 1; i >= 0; i-- {
		last := incomplete[i]
		if last == '{' {
			f = append(f, '}')
		} else {
			f = append(f, ']')
		}
	}

	var value interface{}
	err = json.Unmarshal(f, &value)
	if err != nil {
		return nil, edse(err)
	}

	return GetShape(id, value, sampleSize)
}
