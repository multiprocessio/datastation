package main

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
