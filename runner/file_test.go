package runner

import (
	"fmt"
	"io/ioutil"
	"math/rand"
	"os"
	"runtime"
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
		inTmp, err := os.CreateTemp("", "")
		assert.Nil(t, err)
		defer inTmp.Close()
		defer os.Remove(inTmp.Name())

		_, err = inTmp.WriteString(test.input)
		assert.Nil(t, err)

		out, err := transformTestFile(inTmp.Name(), transformJSONLinesFile)
		assert.Nil(t, err)

		b, err := jsonMarshal(out)
		assert.Nil(t, err)

		var a []map[string]any
		err = jsonUnmarshal(b, &a)
		assert.Nil(t, err)

		assert.Equal(t, test.output, a)
	}
}

func Test_transformParquetFile(t *testing.T) {
	t.Run("Trivial", func(t *testing.T) {
		_, err := transformTestFile("../testdata/allformats/userdata.parquet", transformParquetFile)
		assert.Nil(t, err)
	})

	t.Run("Correct number of rows", func(t *testing.T) {
		out, err := transformTestFile("../testdata/allformats/large.parquet", transformParquetFile)
		assert.Nil(t, err)

		m := out.([]any)
		assert.Equal(t, 40000, len(m))
	})
}

func Test_transformORCFile(t *testing.T) {
	inTmp, err := os.CreateTemp("", "")
	assert.Nil(t, err)
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

	out, err := transformTestFile(inTmp.Name(), transformORCFile)
	assert.Nil(t, err)

	b, err := jsonMarshal(out)
	assert.Nil(t, err)

	var m []map[string]any
	err = jsonUnmarshal(b, &m)
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

	out, err := transformTestFile(inTmp.Name(), transformAvroFile)
	assert.Nil(t, err)

	b, err := jsonMarshal(out)
	assert.Nil(t, err)

	var actJson []map[string]any
	err = jsonUnmarshal(b, &actJson)
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

		_, err = inTmp.WriteString(test)
		assert.Nil(t, err)

		out, err := transformTestFile(inTmp.Name(), transformGenericFile)
		assert.Nil(t, err)

		assert.Equal(t, test, out)

		err = os.Remove(inTmp.Name())
		// For some reason this fails on Windows
		if runtime.GOOS != "windows" {
			assert.Nil(t, err)
		}
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
		out, err := transformTestFile(test.file, test.transformer)
		assert.Nil(t, err)

		assert.Equal(t, test.expectedValue, out)
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
	csvTmp, err := os.CreateTemp("", "")
	defer func() {
		_ = csvTmp.Close()
	}()
	defer os.Remove(csvTmp.Name())
	assert.Nil(t, err)

	_, err = csvTmp.WriteString(`name,age
kerry,12
marge,15
michael,10`)
	assert.Nil(t, err)

	out, err := transformTestFile(csvTmp.Name(), func(filename string, rw *ResultWriter) error {
		return transformCSVFile(filename, rw, ',', false)
	})
	assert.Nil(t, err)

	test :=
		`[
		{
			"name": "kerry",
			"age":  "12"
		},
		{
			"name": "marge",
			"age":  "15"
		},
		{
			"name": "michael",
			"age":  "10"
		}
	]`
	var exp any
	err = jsonUnmarshal([]byte(test), &exp)
	assert.Nil(t, err)

	assert.Equal(t, out, exp)
}

// Benchmarks

func Test_transformCSV_BENCHMARK(t *testing.T) {
	if os.Getenv("BENCHMARK") != "true" {
		return
	}

	// curl -LO https://s3.amazonaws.com/nyc-tlc/trip+data/yellow_tripdata_2021-04.csv
	start := time.Now()

	_, err := transformTestFile("taxi.csv", func(filename string, rw *ResultWriter) error {
		return transformCSVFile(filename, rw, ',', false)
	})
	assert.Nil(t, err)

	fmt.Printf("transform csv took %s\n", time.Since(start))
}

func Test_transformYAMLFile(t *testing.T) {
	tests := []struct {
		description, in, exp string
	}{
		{
			"Trivial",
			`
a: b
`,
			`{"a": "b"}`,
		},
		{
			"Nested values",
			`
a:
  b: c
`,
			`{"a": {"b": "c"}}`,
		},
		{
			"Various primitives",
			`
a: true
b: 1
c: 1.234
d:
`,
			`{"a": true, "b": 1, "c": 1.234, "d": null}`,
		},
		{
			"Lists",
			`
a: [a, b, c]
b:
  - a
  - b
  - c
`,
			`{"a": ["a", "b", "c"], "b": ["a", "b", "c"] }`,
		},
		{
			"Folding/including newlines",
			`
a: |
  abc
  123
    xyz
b: >
  abc
  123
    xyz
`,
			`{"a": "abc\n123\n  xyz\n", "b": "abc 123\n  xyz\n"}`,
		},
		{
			"Top-level lists",
			`
- a: "abc"
  b: "123"
- c: "abc"
- "abc"
`,
			`[{"a": "abc", "b": "123"}, {"c": "abc"}, "abc"]`,
		},
		{
			"Comments",
			`
# This is a comment
a: b`,
			`{"a": "b"}`,
		},
		{
			"Multiple documents",
			`
a: b
---
c: d
`,
			`[{"a": "b"}, {"c": "d"}]`,
		},
	}

	for _, test := range tests {
		t.Run(test.description, func(t *testing.T) {
			inTmp, err := os.CreateTemp("", "")
			assert.Nil(t, err)
			defer inTmp.Close()
			defer os.Remove(inTmp.Name())

			_, err = inTmp.Write([]byte(test.in))
			assert.Nil(t, err)

			out, err := transformTestFile(inTmp.Name(), transformYAMLFile)
			assert.Nil(t, err)

			var exp any
			err = jsonUnmarshal([]byte(test.exp), &exp)
			assert.Nil(t, err)

			assert.Equal(t, out, exp)
		})
	}
}

func Test_transformLogFmtFile(t *testing.T) {
	tests := []struct {
		description,
		in,
		expected string
	}{
		{
			"Trivial",
			"level=info tag=stopping_fetchers id=ConsumerFetcherManager-1382721708341 module=kafka.consumer.ConsumerFetcherManager",
			`[{"id":"ConsumerFetcherManager-1382721708341","level":"info","module":"kafka.consumer.ConsumerFetcherManager","tag":"stopping_fetchers"}]`,
		},
		{
			description: "Multiline",
			in: `time="2015-03-26T01:27:38-04:00" level=debug msg="Started observing beach" animal=walrus number=8
time="2015-03-26T01:27:38-04:00" level=info msg="A group of walrus emerges from the ocean" animal=walrus size=10
time="2015-03-26T01:27:38-04:00" level=warning msg="The group's number increased tremendously!" number=122 omg=true`,
			expected: `[
   {
      "animal":"walrus",
      "level":"debug",
      "msg":"Started observing beach",
      "number":"8",
      "time":"2015-03-26T01:27:38-04:00"
   },
   {
      "animal":"walrus",
      "level":"info",
      "msg":"A group of walrus emerges from the ocean",
      "size":"10",
      "time":"2015-03-26T01:27:38-04:00"
   },
   {
      "level":"warning",
      "msg":"The group's number increased tremendously!",
      "number":"122",
      "omg":"true",
      "time":"2015-03-26T01:27:38-04:00"
   }
]`,
		},
	}

	for _, test := range tests {
		t.Run(test.description, func(t *testing.T) {
			inTmp, err := os.CreateTemp("", "")
			assert.Nil(t, err)
			defer func() {
				inTmp.Close()
			}()

			_, err = inTmp.Write([]byte(test.in))
			assert.Nil(t, err)

			out, err := transformTestFile(inTmp.Name(), transformLogFmtFile)
			assert.Nil(t, err)

			var exp any
			err = jsonUnmarshal([]byte(test.expected), &exp)
			assert.Nil(t, err)

			assert.Equal(t, exp, out)
		})
	}
}

func transformTestFile(filename string, transformFile func(string, *ResultWriter) error) (any, error) {
	outTmp, err := os.CreateTemp("", "")
	if err != nil {
		return nil, err
	}
	defer outTmp.Close()
	defer os.Remove(outTmp.Name())

	jw, err := openJSONResultItemWriter(outTmp.Name(), nil)
	if err != nil {
		return nil, err
	}
	rw := NewResultWriter(jw)
	err = transformFile(filename, rw)
	rw.Close()
	if err != nil {
		return nil, err
	}

	outTmpBs, err := ioutil.ReadFile(outTmp.Name())
	if err != nil {
		return nil, err
	}

	var out any
	err = jsonUnmarshal(outTmpBs, &out)
	if err != nil {
		return nil, err
	}

	return out, nil

}
