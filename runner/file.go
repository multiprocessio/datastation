package main

import (
	"bufio"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	"github.com/xitongsys/parquet-go-source/local"
	"github.com/xitongsys/parquet-go/reader"
	"github.com/xitongsys/parquet-go/source"
	"github.com/xuri/excelize/v2"
)

var preferredParallelism = runtime.NumCPU() * 2

type UnicodeEscape string

func (ue UnicodeEscape) MarshalJSON() ([]byte, error) {
	return []byte(strconv.QuoteToASCII(string(ue))), nil
}

type JSONArrayWriter struct {
	w io.Writer
}

func (j JSONArrayWriter) Write(row interface{}) error {
	encoder := json.NewEncoder(j.w)
	err := encoder.Encode(row)
	if err != nil {
		return err
	}

	_, err = j.w.Write([]byte(","))
	return err
}

func overwriteLastChar(w *os.File, c string) error {
	// Find current offset
	lastChar, err := w.Seek(0, io.SeekCurrent)
	if err != nil {
		return err
	}

	if lastChar > 1 {
		// Overwrite the last comma
		lastChar = lastChar - 1
	}

	_, err = w.WriteAt([]byte(c), lastChar)
	if err != nil {
		return err
	}

	return w.Truncate(lastChar + 1)
}

func withJSONOutWriter(w *os.File, first, last string, cb func() error) error {
	_, err := w.WriteString(first)
	if err != nil {
		return err
	}

	err = cb()
	if err != nil {
		return err
	}

	return overwriteLastChar(w, last)
}

func withJSONArrayOutWriter(w *os.File, cb func(w JSONArrayWriter) error) error {
	return withJSONOutWriter(w, "[", "]", func() error {
		return cb(JSONArrayWriter{w})
	})
}

func withJSONArrayOutWriterFile(out string, cb func(w JSONArrayWriter) error) error {
	w, err := os.OpenFile(out, os.O_WRONLY|os.O_CREATE, os.ModePerm)
	if err != nil {
		return err
	}
	defer w.Close()

	return withJSONArrayOutWriter(w, cb)
}

func transformCSV(in io.Reader, out string) error {
	r := csv.NewReader(in)

	return withJSONArrayOutWriterFile(out, func(w JSONArrayWriter) error {
		isHeader := true
		var fields []string
		for {
			record, err := r.Read()
			if err == io.EOF {
				err = nil
				break
			}

			if err != nil {
				return err
			}

			if isHeader {
				for _, field := range record {
					fields = append(fields, field)
				}
				isHeader = false
				continue
			}

			row := map[string]UnicodeEscape{}
			for i, field := range fields {
				row[field] = UnicodeEscape(record[i])
			}

			err = w.Write(row)
			if err != nil {
				return err
			}
		}

		return nil
	})
}

func transformCSVFile(in, out string) error {
	f, err := os.Open(in)
	if err != nil {
		return err
	}
	defer f.Close()

	return transformCSV(f, out)
}

func transformJSON(in io.Reader, out string) error {
	w, err := os.OpenFile(out, os.O_WRONLY|os.O_CREATE, os.ModePerm)
	if err != nil {
		return err
	}
	defer w.Close()

	_, err = w.ReadFrom(in)
	if err == io.EOF {
		err = nil
	}

	return err
}

func transformJSONFile(in, out string) error {
	r, err := os.Open(in)
	if err != nil {
		return err
	}
	defer r.Close()

	return transformJSON(r, out)
}

func transformParquet(in source.ParquetFile, out string) error {
	r, err := reader.NewParquetReader(in, nil, int64(preferredParallelism))
	if err != nil {
		return err
	}
	defer r.ReadStop()

	return withJSONArrayOutWriterFile(out, func(w JSONArrayWriter) error {
		size := 1000
		var offset int64 = 0
		for {
			err := r.SkipRows(offset)
			if err != nil {
				return err
			}

			rows, err := r.ReadByNumber(size)
			if err != nil {
				return err
			}

			for _, row := range rows {
				err := w.Write(row)
				if err != nil {
					return err
				}
			}

			offset += int64(size)

			if len(rows) < size {
				return nil
			}
		}
	})
}

func transformParquetFile(in, out string) error {
	r, err := local.NewLocalFileReader(in)
	if err != nil {
		return err
	}
	defer r.Close()

	return transformParquet(r, out)
}

func writeXLSXSheet(rows [][]string, w JSONArrayWriter) error {
	var header []string
	isHeader := true

	for _, r := range rows {
		if isHeader {
			header = r
			isHeader = false
			continue
		}

		row := map[string]interface{}{}
		for i, cell := range r {
			row[header[i]] = cell
		}

		err := w.Write(row)
		if err != nil {
			return err
		}
	}

	return nil
}

func transformXLSX(in *excelize.File, out string) error {
	sheets := in.GetSheetList()

	// Single sheet files get flattened into just an array, not a dict mapping sheet name to sheet contents
	if len(sheets) == 1 {
		return withJSONArrayOutWriterFile(out, func(w JSONArrayWriter) error {
			rows, err := in.GetRows(sheets[0])
			if err != nil {
				return err
			}

			return writeXLSXSheet(rows, w)
		})
	}

	w, err := os.OpenFile(out, os.O_WRONLY|os.O_CREATE, os.ModePerm)
	if err != nil {
		return err
	}
	defer w.Close()

	return withJSONOutWriter(w, "{", "}", func() error {
		for _, sheet := range sheets {
			_, err = w.WriteString(`"` + strings.ReplaceAll(sheet, `"`, `\\"`) + `":`)
			if err != nil {
				return err
			}

			err = withJSONArrayOutWriter(w, func(w JSONArrayWriter) error {
				rows, err := in.GetRows(sheet)
				if err != nil {
					return err
				}
				return writeXLSXSheet(rows, w)
			})
			if err != nil {
				return err
			}

			_, err = w.WriteString(",")
			if err != nil {
				return err
			}
		}

		return nil
	})
}

func transformXLSXFile(in, out string) error {
	f, err := excelize.OpenFile(in)
	if err != nil {
		return err
	}

	return transformXLSX(f, out)
}

func transformGeneric(in io.Reader, out string) error {
	bs, err := ioutil.ReadAll(in)
	if err != nil {
		return nil
	}

	w, err := os.OpenFile(out, os.O_WRONLY|os.O_CREATE, os.ModePerm)
	if err != nil {
		return err
	}
	defer w.Close()

	encoder := json.NewEncoder(w)
	return encoder.Encode(bs)
}

func transformGenericFile(in, out string) error {
	r, err := os.Open(in)
	if err != nil {
		return err
	}
	defer r.Close()

	return transformGeneric(r, out)
}

func transformJSONLines(in io.Reader, out string) error {
	w, err := os.OpenFile(out, os.O_WRONLY|os.O_CREATE, os.ModePerm)
	if err != nil {
		return err
	}
	defer w.Close()

	return withJSONOutWriter(w, "[", "]", func() error {
		scanner := bufio.NewScanner(in)
		for scanner.Scan() {
			w.WriteString(scanner.Text() + ",")
		}
		return scanner.Err()
	})
}

func transformJSONLinesFile(in, out string) error {
	r, err := os.Open(in)
	if err != nil {
		return err
	}
	defer r.Close()

	return transformJSONLines(r, out)
}

var BUILTIN_REGEX = map[string]*regexp.Regexp{
	"text/syslogrfc3164":  regexp.MustCompile(`^\<(?P<pri>[0-9]+)\>(?P<time>[^ ]* {1,2}[^ ]* [^ ]*) (?P<host>[^ ]*) (?P<ident>[^ :\[]*)(?:\[(?P<pid>[0-9]+)\])?(?:[^\:]*\:)? *(?P<message>.*)$`),
	"text/syslogrfc5424":  regexp.MustCompile(""), // TODO: implementme
	"text/apache2DSError": regexp.MustCompile(`^(?P<host>[^ ]*) [^ ]* (?P<user>[^ ]*) \[(?P<time>[^\]]*)\] "(?P<method>\S+)(?: +(?P<path>(?:[^\"]|\.)*?)(?: +\S*)?)?" (?P<code>[^ ]*) (?P<size>[^ ]*)(?: "(?P<referer>(?:[^\"]|\.)*)" "(?P<agent>(?:[^\"]|\.)*)")?$`),
	"text/apache2access":  regexp.MustCompile(`^(?P<host>[^ ]*) [^ ]* (?P<user>[^ ]*) \[(?P<time>[^\]]*)\] "(?P<method>\S+)(?: +(?P<path>(?:[^\"]|\.)*?)(?: +\S*)?)?" (?P<code>[^ ]*) (?P<size>[^ ]*)(?: "(?P<referer>(?:[^\"]|\.)*)" "(?P<agent>(?:[^\"]|\.)*)")?$`),
	"text/nginxaccess":    regexp.MustCompile(`^(?P<remote>[^ ]*) (?P<host>[^ ]*) (?P<user>[^ ]*) \[(?P<time>[^\]]*)\] "(?P<method>\S+)(?: +(?P<path>[^\"]*?)(?: +\S*)?)?" (?P<code>[^ ]*) (?P<size>[^ ]*)(?: "(?P<referer>[^\"]*)" "(?P<agent>[^\"]*)"(?:\s+(?P<http_x_forwarded_for>[^ ]+))?)?$`),
}

func transformRegexp(in io.Reader, out string, re *regexp.Regexp) error {
	w, err := os.OpenFile(out, os.O_WRONLY|os.O_CREATE, os.ModePerm)
	if err != nil {
		return err
	}
	defer w.Close()

	scanner := bufio.NewScanner(in)
	return withJSONArrayOutWriterFile(out, func(w JSONArrayWriter) error {
		for scanner.Scan() {
			var row map[string]string
			match := re.FindStringSubmatch(scanner.Text())
			for i, name := range re.SubexpNames() {
				if i != 0 && name != "" {
					row[name] = match[i]
				}
			}

			err := w.Write(row)
			if err != nil {
				return err
			}
		}

		return scanner.Err()
	})
}

func transformRegexpFile(in, out string, re *regexp.Regexp) error {
	r, err := os.Open(in)
	if err != nil {
		return err
	}
	defer r.Close()

	return transformRegexp(r, out, re)
}

func getMimeType(fileName string, ct ContentTypeInfo) string {
	if ct.Type != "" {
		return ct.Type
	}

	switch filepath.Ext(fileName) {
	case ".csv":
		return "text/csv"
	case ".json":
		return "application/json"
	case ".jsonl":
		return "text/jsonlines"
	case ".xls", ".xlsx":
		return "application/vnd.ms-excel"
	case ".parquet":
		return "parquet"
	}

	return ""
}

func evalFilePanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	cti := panel.File.ContentTypeInfo
	fileName := panel.File.Name
	if panel.ServerId != "" {
		var server *ServerInfo
		for _, s := range project.Servers {
			if s.Id == panel.ServerId {
				cp := s
				server = &cp
				break
			}
		}

		if server == nil {
			return fmt.Errorf("Unknown server: %d" + panel.ServerId)
		}

		out := getPanelResultsFile(project.Id, panel.Id)
		err := remoteFileReader(*server, fileName, func(r io.Reader) error {
			return transformReader(r, fileName, cti, out)
		})
		if err != nil {
			return err
		}
	}

	assumedType := getMimeType(fileName, cti)
	logln("Assumed '%s' from '%s' given '%s' when loading file", assumedType, cti.Type, fileName)

	out := getPanelResultsFile(project.Id, panel.Id)

	switch assumedType {
	case "application/json":
		return transformJSONFile(panel.File.Name, out)
	case "text/csv":
		return transformCSVFile(panel.File.Name, out)
	case "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		return transformXLSXFile(panel.File.Name, out)
	case "parquet":
		return transformParquetFile(panel.File.Name, out)
	case "text/regexplines":
		return transformRegexpFile(panel.File.Name, out, regexp.MustCompile(cti.CustomLineRegexp))
	case "text/jsonlines":
		return transformJSONLinesFile(panel.File.Name, out)
	}

	if re, ok := BUILTIN_REGEX[assumedType]; ok {
		return transformRegexpFile(panel.File.Name, out, re)
	}

	return transformGenericFile(panel.File.Name, out)
}
