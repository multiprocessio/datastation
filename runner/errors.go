package runner

import (
	"encoding/json"
	"fmt"
	"runtime/debug"
	"strings"
)

type DSError struct {
	Name          string         `json:"name"`
	Message       string         `json:"message"`
	Stack         string         `json:"stack"`
	TargetPanelId string         `json:"targetPanelId"`
	Extra         map[string]any `json:"extra"`
}

func (dse *DSError) Error() string {
	s, _ := json.MarshalIndent(dse, "", "  ")
	return "DSError " + string(s) + "\n" + dse.Stack
}

func escapedPanelIdentifier(id string) string {
	return fmt.Sprintf("[%s]", strings.ReplaceAll(id, "]", "\\]"))
}

func makeErrNotAnArrayOfObjects(id string) *DSError {
	return &DSError{
		Name:          "NotAnArrayOfObjectsError",
		Message:       fmt.Sprintf("This panel requires an array of objects as input. Make sure panel %s returns an array of objects.", escapedPanelIdentifier(id)),
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

func makeErrInvalidDependentPanel(id string) *DSError {
	return &DSError{
		Name:          "InvalidDependentPanelError",
		Message:       fmt.Sprintf("A dependent panel's results are not valid. Did you run panel %s?", escapedPanelIdentifier(id)),
		Stack:         string(debug.Stack()),
		TargetPanelId: id,
	}
}

func makeErrBadTemplate(msg string) *DSError {
	return &DSError{
		Name:    "BadTemplateError",
		Stack:   string(debug.Stack()),
		Message: msg,
	}
}

func makeErrUser(msg string) *DSError {
	return &DSError{
		Name:    "UserError",
		Stack:   string(debug.Stack()),
		Message: msg,
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
var Edse = edse

func edsef(msg string, args ...any) *DSError {
	return edse(fmt.Errorf(msg, args...))
}
