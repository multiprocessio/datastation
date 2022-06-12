package runner

import (
	"bufio"
	"encoding/json"
	"io"
	"os"
	"strconv"

	jsonutil "github.com/multiprocessio/go-json"
)

func maybeConvertNumber(value any, convertNumbers bool) any {
	if !convertNumbers {
		return value
	}

	s, ok := value.(string)
	if !ok {
		return value
	}

	return convertNumber(s)
}

func convertNumber(value string) any {
	if converted, err := strconv.Atoi(value); err == nil {
		return converted
	} else if converted, err := strconv.ParseFloat(value, 64); err == nil {
		return converted
	} else {
		return value
	}
}

func indexToExcelColumn(i int) string {
	i -= 1

	if i/26 > 0 {
		return indexToExcelColumn(i/26) + string(rune(i%26+65))
	}

	return string(rune(i%26 + 65))
}

func recordToMap[T any](row map[string]any, fields *[]string, record []T, convertNumbers bool) {
	i := -1 // This is only set to 0 if len(record) > 0
	var el T
	for i, el = range record {
		// If the column doesn't exist, give it an Excel-style name based on its position
		if i >= len(*fields) {
			*fields = append(*fields, indexToExcelColumn(i+1))
		} else if (*fields)[i] == "" {
			// If the column exists but has no name, same thing: Excel-style name
			(*fields)[i] = indexToExcelColumn(i + 1)
		}

		(row)[(*fields)[i]] = maybeConvertNumber(el, convertNumbers)
	}

	// If the record has less fields than we've seen already, set all unseen fields to nil
	for _, field := range (*fields)[i+1:] {
		(row)[field] = nil
	}
}

type ResultItemWriter interface {
	WriteRow(any) error
	SetNamespace(ns string) error
	Close() error
}

type ResultWriterOptions struct {
	sampleMinimum int
	sampleFreq    int
}

type ResultWriter struct {
	w    ResultItemWriter
	opts ResultWriterOptions

	// Internal state

	// Number of rows written
	written int
	// Reusable map for converting records to maps
	rowCache map[string]any
	// Used only by record
	fields []string
}

func newResultWriter(w ResultItemWriter, opts *ResultWriterOptions) *ResultWriter {
	rw := &ResultWriter{w: w, rowCache: map[string]any{}}

	if opts == nil {
		rw.opts = ResultWriterOptions{
			sampleMinimum: 10_000,
			sampleFreq:    1_000,
		}
	} else {
		rw.opts = *opts
	}

	return rw
}

func (rw *ResultWriter) WriteRow(r any) error {
	rw.written++
	if rw.written < rw.sampleMinimum {
		// take sample
	}

	return rw.w.WriteRow(r)
}

func (rw *ResultWriter) SetNamespace(ns string) error {
	return rw.w.SetNamespace(ns)
}

func (rw *ResultWriter) SetFields(fs []string) {
	rw.fields = fs
}

func (rw *ResultWriter) WriteRecord(r []string, convertNumbers bool) error {
	recordToMap[string](rw.rowCache, &rw.fields, r, convertNumbers)
	return rw.WriteRow(rw.rowCache)
}

func (rw *ResultWriter) WriteAnyRecord(r []any, convertNumbers bool) error {
	recordToMap[any](rw.rowCache, &rw.fields, r, convertNumbers)
	return rw.WriteRow(rw.rowCache)
}

func (rw *ResultWriter) Close() error {
	return rw.w.Close()
}

type JSONResultItemWriter struct {
	fd       *os.File
	bfd      *bufio.Writer
	encoder  *jsonutil.StreamEncoder
	isObject bool
}

func openJSONResultItemWriter(f string) (*ResultItemWriter, error) {
	var jw JSONResultItemWriter

	jw.fd, err = openTruncate(f)
	if err != nil {
		return nil, err
	}

	jw.bfd = newBufferedWriter(jw.fd)
	jw.encoder = jsonutil.NewGenericStreamEncoder(jw.bfd, jsonMarshal, true)
	return &jw, err
}

func (jw *JSONResultItemWriter) WriteRow(m any) error {
	return jw.encoder.EncodeRow(m)
}

func (jw *JSONResultItemWriter) SetNamespace(key string) error {
	isFirst := !jw.isObject
	if isFirst {
		err := jw.bfd.WriteByte('{')
		if err != nil {
			return err
		}

		jw.isObject = true
	}

	if !isFirst {
		err := jw.bdf.WriteString("], ")
		if err != nil {
			return err
		}
	}

	return jw.bfd.WriteString(`"` + strings.ReplaceAll(sheet, `"`, `\\"`) + `": [`)
}

func (jw *JSONResultItemWriter) Close() error {
	if jw.isObject {
		err := jw.bdf.WriteString("]}")
		if err != nil {
			return err
		}
	}

	err := jw.bfd.Close()
	if err != nil {
		return err
	}

	return jw.fd.Close()
}

func (ec EvalContext) getResultWriter(projectId, panelId string) (*ResultWriter, error) {
	out := ec.GetPanelResultsFile(projectId, panelId)
	jw, err := openJSONResultItemWriter(out)
	if err != nil {
		return err
	}

	return newResultWriter(jw, nil)
}
