package runner

import (
	"bufio"
	"encoding/csv"
	"encoding/json"
	"strconv"
	"io"
	"io/ioutil"
	"os"
	"os/user"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"

	"github.com/multiprocessio/go-openoffice"

	"github.com/xitongsys/parquet-go-source/local"
	"github.com/xitongsys/parquet-go/reader"
	"github.com/xitongsys/parquet-go/source"
	"github.com/xuri/excelize/v2"
)

var preferredParallelism = runtime.NumCPU() * 2

type JSONArrayWriter struct {
	w              io.Writer
	first          bool
	columns        []string
	columnsEscaped [][]byte
	isMap          bool
}

func newJSONArrayWriter(w io.Writer) *JSONArrayWriter {
	return &JSONArrayWriter{w, true, nil, nil, false}
}

var (
	comma   = []byte(",")
	commaNl = []byte(",\n")
	open    = []byte("{")
	close   = []byte("}")
)

func (j *JSONArrayWriter) Write(row interface{}) error {
	if !j.first {
		_, err := j.w.Write(commaNl)
		if err != nil {
			return edsef("Failed to write JSON delimiter: %s", err)
		}
	} else {
		var r map[string]interface{}
		r, j.isMap = row.(map[string]interface{})

		if j.isMap {
			for k := range r {
				j.columns = append(j.columns, k)
				j.columnsEscaped = append(j.columnsEscaped, []byte(strconv.QuoteToASCII(k) +`:`))
			}
		}
	}

	// The Go JSON encoder spends a lot of time just ordering keys
	// so it's actually a lot faster to define the keys and order
	// once and then generate JSON objects from that column order
	// when the row to write is a map.  So far the only case where
	// the row is not necessarily a map is parquet.
	if j.isMap {
		r := row.(map[string]interface{})
		j.w.Write(open)
		for i, col := range j.columns {
			cellBytes, err := json.Marshal(r[col])
			if err != nil {
				return edse(err)
			}

			var prefix []byte
			if i > 0 {
				prefix = comma
			}
			_, err = j.w.Write(prefix)
			if err != nil {
				return edse(err)
			}

			_, err = j.w.Write(j.columnsEscaped[i])
			if err != nil {
				return edse(err)
			}

			_, err = j.w.Write(cellBytes)
			if err != nil {
				return edse(err)
			}
		}
		j.w.Write(close)
	} else {
		encoder := json.NewEncoder(j.w)
		err := encoder.Encode(row)
		if err != nil {
			return edsef("Failed to encode JSON: %s", err)
		}
	}

	j.first = false
	return nil
}

func withJSONOutWriter(w io.Writer, first, last string, cb func() error) error {
	_, err := w.Write([]byte(first))
	if err != nil {
		return edsef("Failed to write JSON start marker: %s", err)
	}

	err = cb()
	if err != nil {
		return err
	}

	_, err = w.Write([]byte(last))
	if err != nil {
		return edsef("Failed to write JSON end marker: %s", err)
	}

	return nil
}

func withJSONArrayOutWriter(w io.Writer, cb func(w *JSONArrayWriter) error) error {
	return withJSONOutWriter(w, "[", "]", func() error {
		bw := bufio.NewWriterSize(w, 10*1024)
		defer bw.Flush()
		return cb(newJSONArrayWriter(bw))
	})
}

func openTruncate(out string) (*os.File, error) {
	base := filepath.Dir(out)
	_ = os.Mkdir(base, os.ModePerm)
	return os.OpenFile(out, os.O_TRUNC|os.O_WRONLY|os.O_CREATE, os.ModePerm)
}

func withJSONArrayOutWriterFile(out io.Writer, cb func(w *JSONArrayWriter) error) error {
	return withJSONArrayOutWriter(out, cb)
}

func transformCSV(in io.Reader, out io.Writer, delimiter rune) error {
	r := csv.NewReader(in)
	r.Comma = delimiter
	r.ReuseRecord = true
	r.FieldsPerRecord = -1

	return withJSONArrayOutWriterFile(out, func(w *JSONArrayWriter) error {
		isHeader := true
		var fields []string
		row := map[string]interface{}{}

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

func transformCSVFile(in string, out io.Writer, delimiter rune) error {
	f, err := os.Open(in)
	if err != nil {
		return err
	}
	defer f.Close()

	return transformCSV(f, out, delimiter)
}

func transformJSON(in io.Reader, out io.Writer) error {
	_, err := io.Copy(out, in)
	if err == io.EOF {
		err = nil
	}

	return err
}

func transformJSONFile(in string, out io.Writer) error {
	r, err := os.Open(in)
	if err != nil {
		return err
	}
	defer r.Close()

	return transformJSON(r, out)
}

func transformParquet(in source.ParquetFile, out io.Writer) error {
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

func transformParquetFile(in string, out io.Writer) error {
	r, err := local.NewLocalFileReader(in)
	if err != nil {
		return err
	}
	defer r.Close()

	return transformParquet(r, out)
}

func writeSheet(rows [][]string, w *JSONArrayWriter) error {
	var header []string
	isHeader := true

	row := map[string]interface{}{}
	for _, r := range rows {
		if isHeader {
			header = r
			isHeader = false
			continue
		}

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

func transformXLSX(in *excelize.File, out io.Writer) error {
	sheets := in.GetSheetList()

	// Single sheet files get flattened into just an array, not a dict mapping sheet name to sheet contents
	if len(sheets) == 1 {
		return withJSONArrayOutWriterFile(out, func(w *JSONArrayWriter) error {
			rows, err := in.GetRows(sheets[0])
			if err != nil {
				return err
			}

			return writeSheet(rows, w)
		})
	}

	return withJSONOutWriter(out, "{", "}", func() error {
		for i, sheet := range sheets {
			if i == 0 {
				_, err := out.Write([]byte(",\n"))
				if err != nil {
					return err
				}
			}

			sheetNameKey := `"` + strings.ReplaceAll(sheet, `"`, `\\"`) + `":`
			_, err := out.Write([]byte(sheetNameKey))
			if err != nil {
				return err
			}

			err = withJSONArrayOutWriter(out, func(w *JSONArrayWriter) error {
				rows, err := in.GetRows(sheet)
				if err != nil {
					return err
				}
				return writeSheet(rows, w)
			})
			if err != nil {
				return err
			}
		}

		return nil
	})
}

func transformXLSXFile(in string, out io.Writer) error {
	f, err := excelize.OpenFile(in)
	if err != nil {
		return err
	}

	return transformXLSX(f, out)
}

func transformOpenOfficeSheet(in *openoffice.ODSFile, out io.Writer) error {
	doc, err := in.ParseContent()
	if err != nil {
		return edse(err)
	}

	// Single sheet files get flattened into just an array, not a dict mapping sheet name to sheet contents
	if len(doc.Sheets) == 1 {
		return withJSONArrayOutWriterFile(out, func(w *JSONArrayWriter) error {
			return writeSheet(doc.Sheets[0].Strings(), w)
		})
	}

	return withJSONOutWriter(out, "{", "}", func() error {
		for i, sheet := range doc.Sheets {
			if i == 0 {
				_, err := out.Write([]byte(",\n"))
				if err != nil {
					return err
				}
			}

			sheetNameKey := `"` + strings.ReplaceAll(sheet.Name, `"`, `\\"`) + `":`
			_, err := out.Write([]byte(sheetNameKey))
			if err != nil {
				return err
			}

			err = withJSONArrayOutWriter(out, func(w *JSONArrayWriter) error {
				return writeSheet(doc.Sheets[0].Strings(), w)
			})
			if err != nil {
				return err
			}
		}

		return nil
	})
}

func transformOpenOfficeSheetFile(in string, out io.Writer) error {
	f, err := openoffice.OpenODS(in)
	if err != nil {
		return edse(err)
	}

	return transformOpenOfficeSheet(f, out)
}

func transformGeneric(in io.Reader, out io.Writer) error {
	bs, err := ioutil.ReadAll(in)
	if err != nil {
		return nil
	}

	encoder := json.NewEncoder(out)
	// string(bs) otherwise it's converted to bas64
	return encoder.Encode(string(bs))
}

func transformGenericFile(in string, out io.Writer) error {
	r, err := os.Open(in)
	if err != nil {
		return edse(err)
	}
	defer r.Close()

	return transformGeneric(r, out)
}

func transformJSONConcat(in io.Reader, out io.Writer) error {
	return withJSONOutWriter(out, "[", "]", func() error {
		inString := false
		var last byte = ' '
		nFound := 0

		objectStack := 0

		for {
			buf := make([]byte, 1024)
			bytesRead, readErr := in.Read(buf)

			for _, b := range buf[:bytesRead] {
				if b == '"' && last != '\\' {
					inString = !inString
				}

				if !inString {
					if b == '{' {
						if objectStack == 0 && nFound > 0 {
							// Write a comma before the next { gets written
							_, err := out.Write([]byte{','})
							if err != nil {
								return edsef("Could not write string: %s", err)
							}
						}

						objectStack += 1
					}

					if b == '}' {
						objectStack -= 1

						if objectStack == 0 {
							nFound += 1
						}
					}
				}

				_, err := out.Write([]byte{b})
				if err != nil {
					return edsef("Could not write string: %s", err)
				}

				last = b
			}

			if readErr == io.EOF {
				return nil
			}
			if readErr != nil {
				return edse(readErr)
			}
		}
	})
}

func transformJSONConcatFile(in string, out io.Writer) error {
	r, err := os.Open(in)
	if err != nil {
		return err
	}
	defer r.Close()

	return transformJSONConcat(r, out)
}

func transformJSONLines(in io.Reader, out io.Writer) error {
	first := true
	return withJSONOutWriter(out, "[", "]", func() error {
		scanner := bufio.NewScanner(in)
		for scanner.Scan() {
			if !first {
				_, err := out.Write([]byte(",\n"))
				if err != nil {
					return edsef("Could not write delimiter: %s", err)
				}
			}

			_, err := out.Write([]byte(scanner.Text()))
			if err != nil {
				return edsef("Could not write string: %s", err)
			}

			first = false
		}
		return scanner.Err()
	})
}

func transformJSONLinesFile(in string, out io.Writer) error {
	r, err := os.Open(in)
	if err != nil {
		return err
	}
	defer r.Close()

	return transformJSONLines(r, out)
}

var BUILTIN_REGEX = map[MimeType]*regexp.Regexp{
	ApacheErrorMimeType:  regexp.MustCompile(`^\[[^ ]* (?P<time>[^\]]*)\] \[(?P<level>[^\]]*)\](?: \[pid (?P<pid>[^:\]]*)(:[^\]]+)*\])? \[client (?P<client>[^\]]*)\] (?P<message>.*)$`),
	ApacheAccessMimeType: regexp.MustCompile(`^(?P<host>[^ ]*) [^ ]* (?P<user>[^ ]*) \[(?P<time>[^\]]*)\] "(?P<method>\S+)(?: +(?P<path>(?:[^\"]|\.)*?)(?: +\S*)?)?" (?P<code>[^ ]*) (?P<size>[^ ]*)(?: "(?P<referer>(?:[^\"]|\.)*)" "(?P<agent>(?:[^\"]|\.)*)")?$`),
	NginxAccessMimeType:  regexp.MustCompile(`^(?P<remote>[^ ]*) (?P<host>[^ ]*) (?P<user>[^ ]*) \[(?P<time>[^\]]*)\] "(?P<method>\S+)(?: +(?P<path>[^\"]*?)(?: +\S*)?)?" (?P<code>[^ ]*) (?P<size>[^ ]*)(?: "(?P<referer>[^\"]*)" "(?P<agent>[^\"]*)"(?:\s+(?P<http_x_forwarded_for>[^ ]+))?)?$`),
}

func transformRegexp(in io.Reader, out io.Writer, re *regexp.Regexp) error {
	scanner := bufio.NewScanner(in)
	return withJSONArrayOutWriterFile(out, func(w *JSONArrayWriter) error {
		row := map[string]interface{}{}
		for scanner.Scan() {
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

func transformRegexpFile(in string, out io.Writer, re *regexp.Regexp) error {
	r, err := os.Open(in)
	if err != nil {
		return err
	}
	defer r.Close()

	return transformRegexp(r, out, re)
}

type MimeType string

const (
	TSVMimeType             MimeType = "text/tab-separated-values"
	CSVMimeType                      = "text/csv"
	JSONMimeType                     = "application/json"
	JSONLinesMimeType                = "application/jsonlines"
	JSONConcatMimeType               = "application/jsonconcat"
	RegexpLinesMimeType              = "text/regexplines"
	ExcelMimeType                    = "application/vnd.ms-excel"
	ExcelOpenXMLMimeType             = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	OpenOfficeSheetMimeType          = "application/vnd.oasis.opendocument.spreadsheet"
	ParquetMimeType                  = "parquet"
	ApacheErrorMimeType              = "text/apache2error"
	ApacheAccessMimeType             = "text/apache2access"
	NginxAccessMimeType              = "text/nginxaccess"
	UnknownMimeType                  = ""
)

func GetMimeType(fileName string, ct ContentTypeInfo) MimeType {
	if ct.Type != "" {
		return MimeType(ct.Type)
	}

	switch filepath.Ext(fileName) {
	case ".tsv", ".tab":
		return TSVMimeType
	case ".csv":
		return CSVMimeType
	case ".json":
		return JSONMimeType
	case ".jsonl", ".ndjson":
		return JSONLinesMimeType
	case ".cjson":
		return JSONConcatMimeType
	case ".xls", ".xlsx":
		return ExcelMimeType
	case ".ods":
		return OpenOfficeSheetMimeType
	case ".parquet":
		return ParquetMimeType
	}

	return UnknownMimeType
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

func TransformFile(fileName string, cti ContentTypeInfo, out io.Writer) error {
	assumedType := GetMimeType(fileName, cti)

	Logln("Assumed '%s' from '%s' given '%s' when loading file", assumedType, cti.Type, fileName)
	switch assumedType {
	case JSONMimeType:
		return transformJSONFile(fileName, out)
	case CSVMimeType:
		return transformCSVFile(fileName, out, ',')
	case TSVMimeType:
		return transformCSVFile(fileName, out, '\t')
	case ExcelMimeType, ExcelOpenXMLMimeType:
		return transformXLSXFile(fileName, out)
	case ParquetMimeType:
		return transformParquetFile(fileName, out)
	case JSONConcatMimeType:
		return transformJSONConcatFile(fileName, out)
	case RegexpLinesMimeType:
		// There are probably weird cases this won't work but
		// let's wait for a bug report to do more intelligent
		// translation of JavaScript -> Go regexp.
		goRegexp := strings.ReplaceAll(cti.CustomLineRegexp, "(?<", "(?P<")
		return transformRegexpFile(fileName, out, regexp.MustCompile(goRegexp))
	case JSONLinesMimeType:
		return transformJSONLinesFile(fileName, out)
	case OpenOfficeSheetMimeType:
		return transformOpenOfficeSheetFile(fileName, out)
	}

	if re, ok := BUILTIN_REGEX[assumedType]; ok {
		return transformRegexpFile(fileName, out, re)
	}

	return transformGenericFile(fileName, out)
}

func evalFilePanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	cti := panel.File.ContentTypeInfo
	fileName := panel.File.Name
	server, err := getServer(project, panel.ServerId)
	if err != nil {
		return err
	}

	out := GetPanelResultsFile(project.Id, panel.Id)
	w, err := openTruncate(out)
	if err != nil {
		return err
	}
	defer w.Close()

	if server != nil {
		// Resolve ~ to foreign home path.
		// Will break if the server is not Linux.
		fileName = strings.ReplaceAll(fileName, "~", "/home/"+server.Username)

		return remoteFileReader(*server, fileName, func(r io.Reader) error {
			return TransformReader(r, fileName, cti, w)
		})
	}

	fileName = resolvePath(fileName)

	return TransformFile(fileName, cti, w)
}

func resolvePath(p string) string {
	return strings.ReplaceAll(p, "~", HOME)
}
