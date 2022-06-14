package runner

import (
	"fmt"
	"io/ioutil"
	"math/rand"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/linkedin/goavro/v2"
	"github.com/scritchley/orc"
	"github.com/stretchr/testify/assert"
)

func Test_transformJSONLines(t *testing.T) {
	longString := strings.Repeat("Omnis ut ut voluptatem provident eaque necessitatibus quia. Eos veniam qui. ", 1024) // 76kb
	tests := []struct {
		input  string
		output []map[string]any
	}{
		{
			`{"a": 1, "b": 2}
{"a": 2, "b": 3}`,
			[]map[string]any{
				{
					"a": float64(1),
					"b": float64(2),
				},
				{
					"a": float64(2),
					"b": float64(3),
				},
			},
		},
		{
			`{"a": 1, "b": "` + longString + `"}`,
			[]map[string]any{
				{
					"a": float64(1),
					"b": longString,
				},
			},
		},
		{
			`{"a": 1}{"a": 2}`,
			[]map[string]any{
				{"a": float64(1)},
				{"a": float64(2)},
			},
		},
		{
			`{"a {}": 1}{"a {}": 2}`,
			[]map[string]any{
				{"a {}": float64(1)},
				{"a {}": float64(2)},
			},
		},
		{
			`{"a {": "}"}{"a {": "{"}`,
			[]map[string]any{
				{"a {": "}"},
				{"a {": "{"},
			},
		},
		{
			`{"a {": "\"}}"}{"a {": "{\"{"}`,
			[]map[string]any{
				{"a {": `"}}`},
				{"a {": `{"{`},
			},
		},
		{
			`{"a": 1}




{"a": 2}`,
			[]map[string]any{
				{"a": float64(1)},
				{"a": float64(2)},
			},
		},
		{
			`{"a": 1, "b": { "c": [1, {"d": 2}] }}{"a": 1, "b": { "c": [1, {"d": 2}] }}`,
			[]map[string]any{
				{"a": float64(1), "b": map[string]any{"c": []any{float64(1), map[string]any{"d": float64(2)}}}},
				{"a": float64(1), "b": map[string]any{"c": []any{float64(1), map[string]any{"d": float64(2)}}}},
			},
		},
	}

	for _, test := range tests {
		inputFile, err := ioutil.TempFile("", "")
		assert.Nil(t, err)

		inputFile.WriteString(test.input)

		outputFile, err := ioutil.TempFile("", "")
		assert.Nil(t, err)

		jw, err := openJSONResultItemWriter(outputFile.Name(), nil)
		assert.Nil(t, err)

		w := NewResultWriter(jw)
		err = transformJSONLinesFile(inputFile.Name(), w)
		assert.Nil(t, err)

		w.Close()

		var m []map[string]any
		tmp2Bs, err := ioutil.ReadFile(outputFile.Name())
		assert.Nil(t, err)
		err = jsonUnmarshal(tmp2Bs, &m)
		assert.Nil(t, err)

		assert.Equal(t, test.output, m)

		os.Remove(inputFile.Name())
		os.Remove(outputFile.Name())
	}
}

func Test_parquet(t *testing.T) {
	outputFile, err := ioutil.TempFile("", "")
	defer os.Remove(outputFile.Name())
	assert.Nil(t, err)

	jw, err := openJSONResultItemWriter(outputFile.Name(), nil)
	assert.Nil(t, err)

	w := NewResultWriter(jw)
	err = transformParquetFile("../testdata/allformats/userdata.parquet", w)
	assert.Nil(t, err)

	w.Close()

	var m []map[string]any
	tmp2Bs, err := ioutil.ReadFile(outputFile.Name())
	assert.Nil(t, err)
	err = jsonUnmarshal(tmp2Bs, &m)
	assert.Nil(t, err)
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
	var expJson []map[string]any

	// generate test data
	for i := 0; i < length; i++ {
		nestedValues := []any{
			rand.Float64(),
			rand.Int63n(10000) > 5000,
		}

		values := []any{
			fmt.Sprintf("%x", rand.Int63n(1000)),
			rand.Int63n(10000) > 4444,
			rand.Float64(),
			nestedValues,
		}

		expJson = append(expJson, map[string]any{
			"username":      values[0],
			"administrator": values[1],
			"score":         values[2],
			"nested": map[string]any{
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

	jw, err := openJSONResultItemWriter(outTmp.Name(), nil)
	assert.Nil(t, err)

	rw := NewResultWriter(jw)
	err = transformORCFile(inTmp.Name(), rw)
	assert.Nil(t, err)

	rw.Close()

	var m []map[string]any
	outTmpBs, err := ioutil.ReadFile(outTmp.Name())
	assert.Nil(t, err)

	err = jsonUnmarshal(outTmpBs, &m)
	assert.Nil(t, err)

	assert.Equal(t, expJson, m)

}

func Test_transformAvroFile(t *testing.T) {
	inTmp, err := os.CreateTemp("", "")
	assert.Nil(t, err)
	defer inTmp.Close()

	w, err := goavro.NewOCFWriter(goavro.OCFConfig{
		W: inTmp,
		Schema: `{
      "type": "record",
      "name": "LongList",
      "fields" : [ { "name": "username", "type": "string" }, { "name": "id", "type": "double" }, { "name": "correct", "type": "boolean" } ]
			}`,
	})
	assert.Nil(t, err)

	length := 2
	var expJson []map[string]any

	for i := 0; i < length; i++ {
		values := map[string]any{
			"username": fmt.Sprintf("user_%d", rand.Int63n(5000)),
			"id":       float64(rand.Int63n(500)),
			"correct":  rand.Int63n(5000) > 2500,
		}
		expJson = append(expJson, values)
	}

	err = w.Append(expJson)
	assert.Nil(t, err)

	outTmp, err := os.CreateTemp("", "")
	assert.Nil(t, err)
	defer os.Remove(outTmp.Name())
	defer outTmp.Close()

	jw, err := openJSONResultItemWriter(outTmp.Name(), nil)
	assert.Nil(t, err)

	rw := NewResultWriter(jw)
	err = transformAvroFile(inTmp.Name(), rw)
	assert.Nil(t, err)

	rw.Close()

	outTmpBs, err := os.ReadFile(outTmp.Name())
	assert.Nil(t, err)

	var actJson []map[string]any
	err = jsonUnmarshal(outTmpBs, &actJson)
	assert.Nil(t, err)

	assert.Equal(t, expJson, actJson)
}

func Test_transformGeneric(t *testing.T) {
	tests := []string{
		`abcdef`,
		`ab""cdef`,
		`ab
cdef`,
	}

	for _, test := range tests {
		inTmp, err := ioutil.TempFile("", "")

		assert.Nil(t, err)

		inTmp.WriteString(test)

		outTmp, err := ioutil.TempFile("", "")
		assert.Nil(t, err)

		jw, err := openJSONResultItemWriter(outTmp.Name(), nil)
		assert.Nil(t, err)

		w := NewResultWriter(jw)
		err = transformGenericFile(inTmp.Name(), w)
		assert.Nil(t, err)

		w.Close()

		var m any
		outTmpBs, err := ioutil.ReadFile(outTmp.Name())
		assert.Nil(t, err)
		err = jsonUnmarshal(outTmpBs, &m)
		assert.Nil(t, err)

		assert.Equal(t, test, m)

		os.Remove(inTmp.Name())
		os.Remove(outTmp.Name())
	}
}

func Test_regressions(t *testing.T) {
	tests := []struct {
		file          string
		expectedValue any
		transformer   func(string, *ResultWriter) error
	}{
		{
			"../testdata/regr/multiple-sheets.xlsx",
			map[string]any{
				"Sheet1": []any{
					map[string]any{"name": "Kevin", "age": "12"},
					map[string]any{"name": "Mary", "age": "14"},
				},
				"Sheet2": []any{
					map[string]any{"name": "Ted", "age": "10"},
					map[string]any{"name": "Gabby", "age": "11"},
				},
			},
			transformXLSXFile,
		},
		{
			"../testdata/regr/217.xlsx",
			[]any{
				map[string]any{
					"A": "a1",
					"B": "b1",
					"C": "c1",
					"D": "d1",
				},
				map[string]any{
					"A": "a2",
					"B": "b2",
					"C": "c2",
					"D": nil,
				},
				map[string]any{
					"A": "a3",
					"B": "b3",
					"C": nil,
					"D": nil,
				},
				map[string]any{
					"A": "a4",
					"B": nil,
					"C": nil,
					"D": nil,
				},
			},
			transformXLSXFile,
		},
	}

	for _, test := range tests {
		outTmp, err := ioutil.TempFile("", "")
		assert.Nil(t, err)

		jw, err := openJSONResultItemWriter(outTmp.Name(), nil)
		assert.Nil(t, err)

		w := NewResultWriter(jw)

		err = test.transformer(test.file, w)
		assert.Nil(t, err)

		w.Close()

		out, err := os.ReadFile(outTmp.Name())
		assert.Nil(t, err)

		var d any
		err = jsonUnmarshal(out, &d)
		assert.Nil(t, err)

		assert.Equal(t, test.expectedValue, d)

		os.Remove(outTmp.Name())
	}
}

func Test_resolvePath(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{
			"~/x",
			HOME + "/x",
		},
		{
			"C:\foo~1\bar",
			"C:\foo~1\bar",
		},
	}

	for _, test := range tests {
		assert.Equal(t, test.expected, resolvePath(test.input))
	}
}

func Test_transformCSV(t *testing.T) {
	csvTmp, err := ioutil.TempFile("", "")
	defer os.Remove(csvTmp.Name())
	assert.Nil(t, err)

	_, err = csvTmp.WriteString(`name,age
kerry,12
marge,15
michael,10`)
	assert.Nil(t, err)

	outTmp, err := ioutil.TempFile("", "")
	defer os.Remove(outTmp.Name())
	assert.Nil(t, err)

	jw, err := openJSONResultItemWriter(outTmp.Name(), nil)
	assert.Nil(t, err)

	w := NewResultWriter(jw)

	err = transformCSVFile(csvTmp.Name(), w, ',', false)
	assert.Nil(t, err)
	w.Close()

	bs, err := os.ReadFile(outTmp.Name())
	assert.Nil(t, err)

	var a []map[string]any
	err = jsonUnmarshal(bs, &a)
	assert.Nil(t, err)

	assert.Equal(t, []map[string]any{
		{
			"name": "kerry",
			"age":  "12",
		},
		{
			"name": "marge",
			"age":  "15",
		},
		{
			"name": "michael",
			"age":  "10",
		},
	}, a)
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

	jw, err := openJSONResultItemWriter(outTmp.Name(), nil)
	assert.Nil(t, err)

	w := NewResultWriter(jw)
	err = transformCSVFile("taxi.csv", w, ',', false)
	assert.Nil(t, err)

	w.Close()

	fmt.Printf("transform csv took %s\n", time.Since(start))
}
