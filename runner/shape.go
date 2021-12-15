package main

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
