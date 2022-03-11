package runner

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math/rand"
	"os"
	"testing"
	"time"

	"github.com/scritchley/orc"
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

	err = transformJSONLinesFile(tmp.Name(), tmp2)
	assert.Nil(t, err)

	var m []map[string]interface{}
	tmp2Bs, err := ioutil.ReadFile(tmp2.Name())
	assert.Nil(t, err)
	err = json.Unmarshal(tmp2Bs, &m)
	assert.Nil(t, err)

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

func Test_transformJSONConcat(t *testing.T) {
	tests := []struct {
		in  string
		out interface{}
	}{
		{
			in: `{"a": 1}{"a": 2}`,
			out: []map[string]interface{}{
				{"a": float64(1)},
				{"a": float64(2)},
			},
		},
		{
			in: `{"a {}": 1}{"a {}": 2}`,
			out: []map[string]interface{}{
				{"a {}": float64(1)},
				{"a {}": float64(2)},
			},
		},
		{
			in: `{"a {": "}"}{"a {": "{"}`,
			out: []map[string]interface{}{
				{"a {": "}"},
				{"a {": "{"},
			},
		},
		{
			in: `{"a {": "\"}}"}{"a {": "{\"{"}`,
			out: []map[string]interface{}{
				{"a {": `"}}`},
				{"a {": `{"{`},
			},
		},
		{
			in: `{"a": 1}




{"a": 2}`,
			out: []map[string]interface{}{
				{"a": float64(1)},
				{"a": float64(2)},
			},
		},
		{
			in: `{"a": 1, "b": { "c": [1, {"d": 2}] }}{"a": 1, "b": { "c": [1, {"d": 2}] }}`,
			out: []map[string]interface{}{
				{"a": float64(1), "b": map[string]interface{}{"c": []interface{}{float64(1), map[string]interface{}{"d": float64(2)}}}},
				{"a": float64(1), "b": map[string]interface{}{"c": []interface{}{float64(1), map[string]interface{}{"d": float64(2)}}}},
			},
		},
	}

	for _, test := range tests {
		inTmp, err := ioutil.TempFile("", "")
		defer os.Remove(inTmp.Name())
		assert.Nil(t, err)

		inTmp.WriteString(test.in)

		outTmp, err := ioutil.TempFile("", "")
		defer os.Remove(outTmp.Name())
		assert.Nil(t, err)

		err = transformJSONConcatFile(inTmp.Name(), outTmp)
		assert.Nil(t, err)

		var m []map[string]interface{}
		outTmpBs, err := ioutil.ReadFile(outTmp.Name())
		assert.Nil(t, err)
		err = json.Unmarshal(outTmpBs, &m)
		assert.Nil(t, err)

		assert.Equal(t, test.out, m)
	}
}

func Test_transformORCFile(t *testing.T) {
	inTmp, err := ioutil.TempFile("", "")
	assert.Nil(t, err)
	defer os.Remove(inTmp.Name())
	defer inTmp.Close()

	// define column types for ORC file
	schema, err := orc.ParseSchema("struct<username:string,administrator:boolean,score:double,nested:struct<randomnumber:double,correct:boolean>>")
	assert.Nil(t, err)

	w, err := orc.NewWriter(inTmp, orc.SetSchema(schema))
	assert.Nil(t, err)

	length := 2 // number of rows to create

	// will hold output data for test
	var expJson []map[string]interface{}

	// generate test data
	for i := 0; i < length; i++ {
		nestedValues := []interface{}{
			rand.Float64(),
			rand.Int63n(10000) > 5000,
		}

		values := []interface{}{
			fmt.Sprintf("%x", rand.Int63n(1000)),
			rand.Int63n(10000) > 4444,
			rand.Float64(),
			nestedValues,
		}

		expJson = append(expJson, map[string]interface{}{
			"username":      values[0],
			"administrator": values[1],
			"score":         values[2],
			"nested": map[string]interface{}{
				"randomnumber": nestedValues[0],
				"correct":      nestedValues[1],
			},
		})

		err = w.Write(values...)
		assert.Nil(t, err)
	}

	err = w.Close()
	assert.Nil(t, err)

	outTmp, err := ioutil.TempFile("", "")
	defer os.Remove(outTmp.Name())
	assert.Nil(t, err)

	err = transformORCFile(inTmp.Name(), outTmp)
	assert.Nil(t, err)

	var m []map[string]interface{}
	outTmpBs, err := ioutil.ReadFile(outTmp.Name())
	assert.Nil(t, err)

	err = json.Unmarshal(outTmpBs, &m)
	assert.Nil(t, err)

	assert.Equal(t, expJson, m)

}

func Test_transformGeneric(t *testing.T) {
	tests := []struct {
		in  string
		out interface{}
	}{
		{
			in:  `abcdef`,
			out: `abcdef`,
		},
		{
			in:  `ab""cdef`,
			out: `ab""cdef`,
		},
	}

	for _, test := range tests {
		inTmp, err := ioutil.TempFile("", "")
		defer os.Remove(inTmp.Name())
		assert.Nil(t, err)

		inTmp.WriteString(test.in)

		outTmp, err := ioutil.TempFile("", "")
		defer os.Remove(outTmp.Name())
		assert.Nil(t, err)

		err = transformGenericFile(inTmp.Name(), outTmp)
		assert.Nil(t, err)

		var m interface{}
		outTmpBs, err := ioutil.ReadFile(outTmp.Name())
		assert.Nil(t, err)
		err = json.Unmarshal(outTmpBs, &m)
		assert.Nil(t, err)

		assert.Equal(t, test.out, m)
	}
}

// Benchmarks

func Test_transformCSV_BENCHMARK(t *testing.T) {
	if os.Getenv("BENCHMARK") != "true" {
		return
	}

	// curl -LO https://s3.amazonaws.com/nyc-tlc/trip+data/yellow_tripdata_2021-04.csv
	outTmp, err := ioutil.TempFile("", "")
	defer os.Remove(outTmp.Name())
	assert.Nil(t, err)

	start := time.Now()
	err = transformCSVFile("taxi.csv", outTmp, ',')
	assert.Nil(t, err)

	fmt.Printf("transform csv took %s\n", time.Since(start))
}
