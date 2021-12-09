package main

import (
	"encoding/json"
	"fmt"
)

func makeErr(name string, e map[string]interface{}) error {
	if e == nil {
		e = map[string]interface{}{}
	}

	e["name"] = name

	bytes, err := json.Marshal(e)
	if err != nil {
		panic(err)
	}

	return fmt.Errorf("%s", bytes)
}

func makeErrNotAnArrayOfObjects(id string) error {
	return makeErr("NotAnArrayOfObjects", map[string]interface{}{
		"panelId": id,
	})
}

func makeErrUnsupported(msg string) error {
	return makeErr("Unsupported", map[string]interface{}{
		"message": msg,
	})
}
