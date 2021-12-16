package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_transformJSONLines(t *testing.T) {
	tmp, err := ioutil.TempFile("", "")
	defer os.Remove(tmp.Name())
	assert.Nil(t, err)

	tmp.WriteString(`{"a": 1, "b": 2}
{"a": 2, "b": 3}`)

	tmp2, err := ioutil.TempFile("", "")
	defer os.Remove(tmp2.Name())
	assert.Nil(t, err)

	err = transformJSONLinesFile(tmp.Name(), tmp2.Name())
	assert.Nil(t, err)

	var m []map[string]interface{}
	tmp2Bs, err := ioutil.ReadFile(tmp2.Name())
	assert.Nil(t, err)
	err = json.Unmarshal(tmp2Bs, &m)
	assert.Nil(t, err)

	fmt.Println(string(tmp2Bs))
	assert.Equal(t, []map[string]interface{}{
		{
			"a": float64(1),
			"b": float64(2),
		},
		{
			"a": float64(2),
			"b": float64(3),
		},
	}, m)
}
