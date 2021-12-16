package main

import (
	"bufio"
	"encoding/csv"
	"encoding/json"
	"io"
	"io/ioutil"
	"os"
	"os/user"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"

	"github.com/xitongsys/parquet-go-source/local"
	"github.com/xitongsys/parquet-go/reader"
	"github.com/xitongsys/parquet-go/source"
	"github.com/xuri/excelize/v2"
)

var preferredParallelism = runtime.NumCPU() * 2

type JSONArrayWriter struct {
	w     io.Writer
	first bool
}

func (j *JSONArrayWriter) Write(row interface{}) error {
	if !j.first {
		_, err := j.w.Write([]byte(",\n"))
		if err != nil {
			return edsef("Failed to write JSON delimiter: %s", err)
		}
	}
	encoder := json.NewEncoder(j.w)
	err := encoder.Encode(row)
	if err != nil {
		return edsef("Failed to encode JSON: %s", err)
	}

	j.first = false
	return nil
}

func withJSONOutWriter(w *os.File, first, last string, cb func() error) error {
	_, err := w.WriteString(first)
	if err != nil {
		return edsef("Failed to write JSON start marker: %s", err)
	}

	err = cb()
	if err != nil {
		return err
	}

	_, err = w.WriteString(last)
	if err != nil {
		return edsef("Failed to write JSON end marker: %s", err)
	}

	return nil
}

func withJSONArrayOutWriter(w *os.File, cb func(w *JSONArrayWriter) error) error {
	return withJSONOutWriter(w, "[", "]", func() error {
		return cb(&JSONArrayWriter{w, true})
	})
}

func openTruncate(out string) (*os.File, error) {
	return os.OpenFile(out, os.O_TRUNC|os.O_WRONLY|os.O_CREATE, os.ModePerm)
}

func withJSONArrayOutWriterFile(out string, cb func(w *JSONArrayWriter) error) error {
	w, err := openTruncate(out)
	if err != nil {
		return err
	}
	defer w.Close()

	return withJSONArrayOutWriter(w, cb)
}

func transformCSV(in io.Reader, out string) error {
	r := csv.NewReader(in)

	return withJSONArrayOutWriterFile(out, func(w *JSONArrayWriter) error {
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

			row := map[string]string{}
			for i, field := range fields {
				row[field] = record[i]
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
	w, err := openTruncate(out)
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

	return withJSONArrayOutWriterFile(out, func(w *JSONArrayWriter) error {
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

func writeXLSXSheet(rows [][]string, w *JSONArrayWriter) error {
	var header []string
	isHeader := true

	for _, r := range rows {
		if isHeader {
			header = r
			isHeader = false
			continue
		}

		row := map[string]string{}
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
		return withJSONArrayOutWriterFile(out, func(w *JSONArrayWriter) error {
			rows, err := in.GetRows(sheets[0])
			if err != nil {
				return err
			}

			return writeXLSXSheet(rows, w)
		})
	}

	w, err := openTruncate(out)
	if err != nil {
		return err
	}
	defer w.Close()

	return withJSONOutWriter(w, "{", "}", func() error {
		for i, sheet := range sheets {
			if i == 0 {
				_, err = w.WriteString(",\n")
				if err != nil {
					return err
				}
			}

			sheetNameKey := `"` + strings.ReplaceAll(sheet, `"`, `\\"`) + `":`
			_, err = w.WriteString(sheetNameKey)
			if err != nil {
				return err
			}

			err = withJSONArrayOutWriter(w, func(w *JSONArrayWriter) error {
				rows, err := in.GetRows(sheet)
				if err != nil {
					return err
				}
				return writeXLSXSheet(rows, w)
			})
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

	w, err := openTruncate(out)
	if err != nil {
		return err
	}
	defer w.Close()

	encoder := json.NewEncoder(w)
	// string(bs) otherwise it's converted to bas64
	return encoder.Encode(string(bs))
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
	w, err := openTruncate(out)
	if err != nil {
		return err
	}
	defer w.Close()

	first := true
	return withJSONOutWriter(w, "[", "]", func() error {
		scanner := bufio.NewScanner(in)
		for scanner.Scan() {
			if !first {
				_, err := w.WriteString(",\n")
				if err != nil {
					return edsef("Could not write delimiter: %s", err)
				}
			}

			_, err := w.WriteString(scanner.Text())
			if err != nil {
				return edsef("Could not write string: %s", err)
			}

			first = false
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
	"text/apache2error":  regexp.MustCompile(`^\[[^ ]* (?P<time>[^\]]*)\] \[(?P<level>[^\]]*)\](?: \[pid (?P<pid>[^:\]]*)(:[^\]]+)*\])? \[client (?P<client>[^\]]*)\] (?P<message>.*)$`),
	"text/apache2access": regexp.MustCompile(`^(?P<host>[^ ]*) [^ ]* (?P<user>[^ ]*) \[(?P<time>[^\]]*)\] "(?P<method>\S+)(?: +(?P<path>(?:[^\"]|\.)*?)(?: +\S*)?)?" (?P<code>[^ ]*) (?P<size>[^ ]*)(?: "(?P<referer>(?:[^\"]|\.)*)" "(?P<agent>(?:[^\"]|\.)*)")?$`),
	"text/nginxaccess":   regexp.MustCompile(`^(?P<remote>[^ ]*) (?P<host>[^ ]*) (?P<user>[^ ]*) \[(?P<time>[^\]]*)\] "(?P<method>\S+)(?: +(?P<path>[^\"]*?)(?: +\S*)?)?" (?P<code>[^ ]*) (?P<size>[^ ]*)(?: "(?P<referer>[^\"]*)" "(?P<agent>[^\"]*)"(?:\s+(?P<http_x_forwarded_for>[^ ]+))?)?$`),
}

func transformRegexp(in io.Reader, out string, re *regexp.Regexp) error {
	w, err := openTruncate(out)
	if err != nil {
		return err
	}
	defer w.Close()

	scanner := bufio.NewScanner(in)
	return withJSONArrayOutWriterFile(out, func(w *JSONArrayWriter) error {
		for scanner.Scan() {
			row := map[string]interface{}{}
			match := re.FindStringSubmatch(scanner.Text())
			for i, name := range re.SubexpNames() {
				if name != "" {
					if match[i] != "" {
						row[name] = match[i]
					} else {
						row[name] = nil
					}
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
		return "application/jsonlines"
	case ".xls", ".xlsx":
		return "application/vnd.ms-excel"
	case ".parquet":
		return "parquet"
	}

	return ""
}

func getServer(project *ProjectState, serverId string) (*ServerInfo, error) {
	if serverId == "" {
		return nil, nil
	}

	for _, s := range project.Servers {
		if s.Id == serverId {
			cp := s

			if cp.Username == "" {
				if current, _ := user.Current(); current != nil {
					cp.Username = current.Username
				}
			}
			return &cp, nil
		}
	}

	return nil, edsef("Unknown server: %d" + serverId)
}

func evalFilePanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	cti := panel.File.ContentTypeInfo
	fileName := panel.File.Name
	server, err := getServer(project, panel.ServerId)
	if err != nil {
		return err
	}

	if server != nil {
		// Resolve ~ to foreign home path.
		// Will break if the server is not Linux.
		fileName = strings.ReplaceAll(fileName, "~", "/home/"+server.Username)

		out := getPanelResultsFile(project.Id, panel.Id)
		return remoteFileReader(*server, fileName, func(r io.Reader) error {
			return transformReader(r, fileName, cti, out)
		})
	}

	fileName = resolvePath(fileName)

	assumedType := getMimeType(fileName, cti)
	logln("Assumed '%s' from '%s' given '%s' when loading file", assumedType, cti.Type, fileName)

	out := getPanelResultsFile(project.Id, panel.Id)

	switch assumedType {
	case "application/json":
		return transformJSONFile(fileName, out)
	case "text/csv":
		return transformCSVFile(fileName, out)
	case "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		return transformXLSXFile(fileName, out)
	case "parquet":
		return transformParquetFile(fileName, out)
	case "text/regexplines":
		// There are probably weird cases this won't work but
		// let's wait for a bug report to do more intelligent
		// translation of JavaScript -> Go regexp.
		goRegexp := strings.ReplaceAll(cti.CustomLineRegexp, "(?<", "(?P<")
		return transformRegexpFile(fileName, out, regexp.MustCompile(goRegexp))
	case "application/jsonlines":
		return transformJSONLinesFile(fileName, out)
	}

	if re, ok := BUILTIN_REGEX[assumedType]; ok {
		return transformRegexpFile(fileName, out, re)
	}

	return transformGenericFile(fileName, out)
}

func resolvePath(p string) string {
	return strings.ReplaceAll(p, "~", HOME)
}
