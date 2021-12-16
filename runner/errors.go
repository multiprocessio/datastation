package main

import (
	"encoding/json"
	"fmt"
	"runtime/debug"
)

type DSError struct {
	Name          string                 `json:"name"`
	Message       string                 `json:"message"`
	Stack         string                 `json:"stack"`
	TargetPanelId string                 `json:"targetPanelId"`
	Extra         map[string]interface{} `json:"extra"`
}

func (dse *DSError) Error() string {
	s, _ := json.MarshalIndent(dse, "", "  ")
	return "DSError " + string(s) + "\n" + dse.Stack
}

func makeErrNotAnArrayOfObjects(id string) *DSError {
	return &DSError{
		Name:          "NotAnArrayOfObjectsError",
		TargetPanelId: id,
		Stack:         string(debug.Stack()),
	}
}

func makeErrUnsupported(msg string) *DSError {
	return &DSError{
		Name:    "UnsupportedError",
		Message: msg,
		Stack:   string(debug.Stack()),
	}
}

func makeErrInvalidDependentPanelError(id string) *DSError {
	return &DSError{
		Name:          "InvalidDependentPanelError",
		Stack:         string(debug.Stack()),
		TargetPanelId: id,
	}
}

func makeErrException(e error) *DSError {
	if e == nil {
		return nil
	}

	if dse, ok := e.(*DSError); ok {
		return dse
	}

	return &DSError{
		Name:    "Error",
		Message: e.Error(),
		Stack:   string(debug.Stack()),
	}
}

var edse = makeErrException

func edsef(msg string, args ...interface{}) *DSError {
	return edse(fmt.Errorf(msg, args...))
}
