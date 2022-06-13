package runner

import (
	"bufio"
	"math/rand"
	"os"
	"strconv"
	"strings"

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
	WriteRow(any, int) error
	SetNamespace(ns string) error
	Shape(string, int, int) (*Shape, error)
	Close() error
}

type ResultWriter struct {
	w ResultItemWriter

	// Internal state

	// Number of rows written
	written int
	// Reusable map for converting records to maps
	rowCache map[string]any
	// Used only by record
	fields []string
}

func newResultWriter(w ResultItemWriter) *ResultWriter {
	return &ResultWriter{w: w, rowCache: map[string]any{}}
}

func (rw *ResultWriter) WriteRow(r any) error {
	rw.written++
	return rw.w.WriteRow(r, rw.written-1)
}

func (rw *ResultWriter) SetNamespace(ns string) error {
	return rw.w.SetNamespace(ns)
}

func (rw *ResultWriter) SetFields(fs []string) {
	// Make a copy of the fields array
	if len(rw.fields) != len(fs) {
		rw.fields = make([]string, len(fs))
	}

	for i, f := range fs {
		rw.fields[i] = f
	}
}

func (rw *ResultWriter) WriteRecord(r []string, convertNumbers bool) error {
	recordToMap[string](rw.rowCache, &rw.fields, r, convertNumbers)
	return rw.WriteRow(rw.rowCache)
}

func (rw *ResultWriter) WriteAnyRecord(r []any, convertNumbers bool) error {
	recordToMap[any](rw.rowCache, &rw.fields, r, convertNumbers)
	return rw.WriteRow(rw.rowCache)
}

func (rw *ResultWriter) Shape(id string, maxBytesToRead, sampleSize int) (*Shape, error) {
	return rw.w.Shape(id, maxBytesToRead, sampleSize)
}

func (rw *ResultWriter) Close() error {
	return rw.w.Close()
}

type JSONResultItemWriterOptions struct {
	sampleMinimum int
	sampleFreq    int
}

type JSONResultItemWriter struct {
	fileName string
	fd       *os.File
	bfd      *bufio.Writer
	opts     JSONResultItemWriterOptions

	// Internal state
	encoder  *jsonutil.StreamEncoder
	isObject bool
	// Sampled rows
	sample []any
	// Counter
	written int
}

func openJSONResultItemWriter(f string, opts *JSONResultItemWriterOptions) (ResultItemWriter, error) {
	var jw JSONResultItemWriter
	jw.fileName = f

	if opts == nil {
		jw.opts = JSONResultItemWriterOptions{
			sampleMinimum: 10_000,
			sampleFreq:    1_000,
		}
	} else {
		jw.opts = *opts
	}

	var err error
	jw.fd, err = openTruncate(f)
	if err != nil {
		return nil, err
	}

	jw.bfd = newBufferedWriter(jw.fd)
	return &jw, err
}

func (jw *JSONResultItemWriter) WriteRow(m any, written int) error {
	if written < jw.opts.sampleMinimum {
		jw.sample = append(jw.sample, m)
	} else if rand.Intn(jw.opts.sampleFreq*10) < 10 {
		jw.sample = append(jw.sample, m)
	}

	// Lazily initialize because this starts writing JSON immediately.
	if jw.encoder == nil {
		jw.encoder = jsonutil.NewGenericStreamEncoder(jw.bfd, jsonMarshal, true)
	}
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

	if jw.encoder != nil {
		err := jw.encoder.Close()
		if err != nil {
			return err
		}
	}

	if !isFirst {
		err := jw.bfd.WriteByte(',')
		if err != nil {
			return err
		}
	}

	_, err := jw.bfd.WriteString(`"` + strings.ReplaceAll(key, `"`, `\\"`) + `": `)
	if err != nil {
		return err
	}

	jw.encoder = jsonutil.NewGenericStreamEncoder(jw.bfd, jsonMarshal, true)
	return nil
}

func (jw *JSONResultItemWriter) Close() error {
	if jw.encoder != nil {
		err := jw.encoder.Close()
		if err != nil {
			return err
		}
	}

	if jw.isObject {
		_, err := jw.bfd.WriteString("}")
		if err != nil {
			return err
		}
	}

	err := jw.bfd.Flush()
	if err != nil {
		return err
	}

	return jw.fd.Close()
}

func (jw *JSONResultItemWriter) Shape(id string, maxBytesToRead, sampleSize int) (*Shape, error) {
	if len(jw.sample) > 0 {
		s := GetShape(id, jw.sample, sampleSize)
		return &s, nil
	}

	return ShapeFromFile(jw.fileName, id, maxBytesToRead, sampleSize)
}

/*
type MsgPackResultItemWriter struct {
	fileName string
	fd       *os.File
	bfd      *bufio.Writer
	opts     MsgPackResultItemWriterOptions

	// Internal state
	encoder  *jsonutil.StreamEncoder
	isObject bool
	// Sampled rows
	sample []any
	// Counter
	written int
}

func openMsgPackResultItemWriter(f string, opts *MsgPackResultItemWriterOptions) (ResultItemWriter, error) {
	var mw MsgPackResultItemWriter
	mw.fileName = f

	if opts == nil {
		mw.opts = MsgPackResultItemWriterOptions{
			sampleMinimum: 10_000,
			sampleFreq:    1_000,
		}
	} else {
		mw.opts = *opts
	}

	var err error
	mw.fd, err = openTruncate(f)
	if err != nil {
		return nil, err
	}

	mw.bfd = newBufferedWriter(mw.fd)
	return &mw, err
}

func (mw *MsgPackResultItemWriter) WriteRow(m any, written int) error {
	if written < mw.opts.sampleMinimum {
		mw.sample = append(mw.sample, m)
	} else if rand.Intn(mw.opts.sampleFreq*10) < 10 {
		mw.sample = append(mw.sample, m)
	}

	// Lazily initialize because this starts writing MsgPack immediately.
	if mw.encoder == nil {
		mw.encoder = jsonutil.NewGenericStreamEncoder(mw.bfd, jsonMarshal, true)
	}
	return mw.encoder.EncodeRow(m)
}

func (mw *MsgPackResultItemWriter) SetNamespace(key string) error {
	isFirst := !mw.isObject
	if isFirst {
		err := mw.bfd.WriteByte('{')
		if err != nil {
			return err
		}

		mw.isObject = true
	}

	if mw.encoder != nil {
		err := mw.encoder.Close()
		if err != nil {
			return err
		}
	}

	if !isFirst {
		err := mw.bfd.WriteByte(',')
		if err != nil {
			return err
		}
	}

	_, err := mw.bfd.WriteString(`"` + strings.ReplaceAll(key, `"`, `\\"`) + `": `)
	if err != nil {
		return err
	}

	mw.encoder = jsonutil.NewGenericStreamEncoder(mw.bfd, jsonMarshal, true)
	return nil
}

func (mw *MsgPackResultItemWriter) Close() error {
	if mw.encoder != nil {
		err := mw.encoder.Close()
		if err != nil {
			return err
		}
	}

	if mw.isObject {
		_, err := mw.bfd.WriteString("}")
		if err != nil {
			return err
		}
	}

	err := mw.bfd.Flush()
	if err != nil {
		return err
	}

	return mw.fd.Close()
}

func (mw *MsgPackResultItemWriter) Shape(id string, maxBytesToRead, sampleSize int) (*Shape, error) {
	if len(mw.sample) > 0 {
		s := GetShape(id, mw.sample, sampleSize)
		return &s, nil
	}

	return ShapeFromFile(mw.fileName, id, maxBytesToRead, sampleSize)
}
*/

func (ec EvalContext) GetResultWriter(projectId, panelId string) (*ResultWriter, error) {
	out := ec.GetPanelResultsFile(projectId, panelId)
	jw, err := openJSONResultItemWriter(out, nil)
	if err != nil {
		return nil, err
	}

	return newResultWriter(jw), nil
}
