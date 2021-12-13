package main

import (
	"fmt"
	"runtime/debug"
)

type DSError struct {
	Name string `json:"name"`
	Message string `json:"message"`
	Stack string `json:"stack"`
	TargetPanelId string `json:"targetPanelId"`
	Extra map[string]interface{} `json:"extra"`
}

func (dse *DSError) Error() string {
	return fmt.Sprintf("%#v", dse)
}

func makeErrNotAnArrayOfObjects(id string) *DSError {
	return &DSError{
		Name: "NotAnArrayOfObjects",
		TargetPanelId: id,
		Stack: string(debug.Stack()),
	}
}

func makeErrUnsupported(msg string) *DSError {
	return &DSError{
		Name: "Unsupported",
		Message: msg,
		Stack: string(debug.Stack()),
	}
}

func makeErrInvalidDependentPanelError(id string) *DSError {
	return &DSError{
		Name: "InvalidDependentPanelError",
		Stack: string(debug.Stack()),
		TargetPanelId: id,
	}
}

func makeErrException(e error) *DSError {
	if e == nil {
		return nil
	}

	return &DSError{
		Name: "Error",
		Message: e.Error(),
		Stack: string(debug.Stack()),
	}
}

var edse = makeErrException
