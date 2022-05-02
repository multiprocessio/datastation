package runner

import (
	"bufio"
	"encoding/csv"
	"io"
	"os"
	"os/user"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"

	"github.com/linkedin/goavro/v2"
	jsonutil "github.com/multiprocessio/go-json"
	"github.com/multiprocessio/go-openoffice"
	"github.com/scritchley/orc"

	"github.com/xitongsys/parquet-go-source/local"
	"github.com/xitongsys/parquet-go/reader"
	"github.com/xitongsys/parquet-go/source"
	"github.com/xuri/excelize/v2"
)

var preferredParallelism = runtime.NumCPU() * 2
var bufSize int = 1e6 // 1MB

func newBufferedWriter(w io.Writer) *bufio.Writer {
	return bufio.NewWriterSize(w, bufSize)
}

func newBufferedReader(w io.Reader) *bufio.Reader {
	return bufio.NewReaderSize(w, bufSize)
}

func openBufferedFile(in string) (*bufio.Reader, func() error, error) {
	r, err := os.Open(in)
	if err != nil {
		return nil, nil, err
	}

	return newBufferedReader(r), r.Close, nil
}

func openTruncate(out string) (*os.File, error) {
	base := filepath.Dir(out)
	_ = os.Mkdir(base, os.ModePerm)
	return os.OpenFile(out, os.O_TRUNC|os.O_WRONLY|os.O_CREATE, os.ModePerm)
}

func openTruncateBufio(out string) (*bufio.Writer, func() error, error) {
	o, err := openTruncate(out)
	if err != nil {
		return nil, nil, err
	}

	return newBufferedWriter(o), o.Close, nil
}

func indexToExcelColumn(i int) string {
	i -= 1

	if i/26 > 0 {
		return indexToExcelColumn(i/26) + string(rune(i%26+65))
	}

	return string(rune(i%26 + 65))
}

func recordToMap[T any](row map[string]any, fields *[]string, record []T) {
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

		(row)[(*fields)[i]] = el
	}

	// If the record has less fields than we've seen already, set all unseen fields to nil
	for _, field := range (*fields)[i+1:] {
		(row)[field] = nil
	}
}

func transformCSV(in *bufio.Reader, out *bufio.Writer, delimiter rune) error {
	r := csv.NewReader(in)
	r.Comma = delimiter
	r.ReuseRecord = true
	r.FieldsPerRecord = -1

	return withJSONArrayOutWriterFile(out, func(w *jsonutil.StreamEncoder) error {
		isHeader := true
		var fields []string
		row := map[string]any{}

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

			recordToMap(row, &fields, record)

			err = w.EncodeRow(row)
			if err != nil {
				return err
			}
		}

		return nil
	})
}

func transformCSVFile(in string, out *bufio.Writer, delimiter rune) error {
	r, closeFile, err := openBufferedFile(in)
	if err != nil {
		return err
	}
	defer closeFile()

	return transformCSV(r, out, delimiter)
}

func transformJSON(in *bufio.Reader, out *bufio.Writer) error {
	_, err := io.Copy(out, in)
	if err == io.EOF {
		err = nil
	}

	return err
}

func transformJSONFile(in string, out *bufio.Writer) error {
	r, closeFile, err := openBufferedFile(in)
	if err != nil {
		return err
	}
	defer closeFile()

	return transformJSON(r, out)
}

func transformParquet(in source.ParquetFile, out *bufio.Writer) error {
	r, err := reader.NewParquetReader(in, nil, int64(preferredParallelism))
	if err != nil {
		return err
	}
	defer r.ReadStop()

	return withJSONArrayOutWriterFile(out, func(w *jsonutil.StreamEncoder) error {
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
				err := w.EncodeRow(row)
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

func transformParquetFile(in string, out *bufio.Writer) error {
	r, err := local.NewLocalFileReader(in)
	if err != nil {
		return err
	}
	defer r.Close()

	return transformParquet(r, out)
}

func transformORC(in *orc.Reader, out *bufio.Writer) error {
	cols := in.Schema().Columns()
	c := in.Select(cols...)

	return withJSONArrayOutWriterFile(out, func(w *jsonutil.StreamEncoder) error {
		row := map[string]any{}

		for c.Stripes() {
			for c.Next() {
				r := c.Row()

				recordToMap(row, &cols, r)

				err := w.EncodeRow(row)
				if err != nil {
					return err
				}
			}
		}

		return c.Err()

	})
}

func transformORCFile(in string, out *bufio.Writer) error {
	r, err := orc.Open(in)
	if err != nil {
		return err
	}
	defer r.Close()

	return transformORC(r, out)
}

func writeSheet(rows [][]string, w *jsonutil.StreamEncoder) error {
	var header []string
	isHeader := true

	row := map[string]any{}
	for _, r := range rows {
		if isHeader {
			header = r
			isHeader = false
			continue
		}

		recordToMap(row, &header, r)

		err := w.EncodeRow(row)
		if err != nil {
			return err
		}
	}

	return nil
}

func transformXLSX(in *excelize.File, out *bufio.Writer) error {
	sheets := in.GetSheetList()

	// Single sheet files get flattened into just an array, not a dict mapping sheet name to sheet contents
	if len(sheets) == 1 {
		return withJSONArrayOutWriterFile(out, func(w *jsonutil.StreamEncoder) error {
			rows, err := in.GetRows(sheets[0])
			if err != nil {
				return err
			}

			return writeSheet(rows, w)
		})
	}

	return withJSONOutWriter(out, "{", "}", func() error {
		for i, sheet := range sheets {
			if i > 0 {
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

			err = withJSONArrayOutWriter(out, func(w *jsonutil.StreamEncoder) error {
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

func transformXLSXFile(in string, out *bufio.Writer) error {
	f, err := excelize.OpenFile(in)
	if err != nil {
		return err
	}

	return transformXLSX(f, out)
}

func transformOpenOfficeSheet(in *openoffice.ODSFile, out *bufio.Writer) error {
	doc, err := in.ParseContent()
	if err != nil {
		return edse(err)
	}

	// Single sheet files get flattened into just an array, not a dict mapping sheet name to sheet contents
	if len(doc.Sheets) == 1 {
		return withJSONArrayOutWriterFile(out, func(w *jsonutil.StreamEncoder) error {
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

			err = withJSONArrayOutWriter(out, func(w *jsonutil.StreamEncoder) error {
				return writeSheet(doc.Sheets[0].Strings(), w)
			})
			if err != nil {
				return err
			}
		}

		return nil
	})
}

func transformOpenOfficeSheetFile(in string, out *bufio.Writer) error {
	f, err := openoffice.OpenODS(in)
	if err != nil {
		return edse(err)
	}

	return transformOpenOfficeSheet(f, out)
}

func transformGeneric(r *bufio.Reader, o *bufio.Writer) error {
	err := o.WriteByte('"')
	if err != nil {
		return err
	}

	for {
		b, err := r.ReadByte()
		if err == io.EOF {
			break
		}

		if err != nil {
			return err
		}

		// Escape necessary characters
		switch b {
		case '\b':
			_, err = o.WriteString(`\b`)
		case '\f':
			_, err = o.WriteString(`\f`)
		case '\n':
			_, err = o.WriteString(`\n`)
		case '\r':
			_, err = o.WriteString(`\r`)
		case '\t':
			_, err = o.WriteString(`\t`)
		case '"':
			_, err = o.WriteString(`\"`)
		case '\\':
			_, err = o.WriteString(`\\`)
		default:
			err = o.WriteByte(b)
		}

		if err != nil {
			return err
		}
	}

	return o.WriteByte('"')
}

func transformGenericFile(in string, out *bufio.Writer) error {
	r, closeFile, err := openBufferedFile(in)
	if err != nil {
		return err
	}
	defer closeFile()

	return transformGeneric(r, out)
}

func transformJSONConcat(in *bufio.Reader, out *bufio.Writer) error {
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

func transformJSONConcatFile(in string, out *bufio.Writer) error {
	r, closeFile, err := openBufferedFile(in)
	if err != nil {
		return err
	}
	defer closeFile()

	return transformJSONConcat(r, out)
}

func newLargeLineScanner(in *bufio.Reader) *bufio.Scanner {
	scanner := bufio.NewScanner(in)

	// Bump line length limit to 1MB (from 64k)
	buf := make([]byte, 4096)
	scanner.Buffer(buf, 1024*1024)
	return scanner
}

func transformJSONLines(in *bufio.Reader, out *bufio.Writer) error {
	first := true
	return withJSONOutWriter(out, "[", "]", func() error {
		scanner := newLargeLineScanner(in)
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

func transformJSONLinesFile(in string, out *bufio.Writer) error {
	r, closeFile, err := openBufferedFile(in)
	if err != nil {
		return err
	}
	defer closeFile()

	return transformJSONLines(r, out)
}

var BUILTIN_REGEX = map[MimeType]*regexp.Regexp{
	ApacheErrorMimeType:  regexp.MustCompile(`^\[[^ ]* (?P<time>[^\]]*)\] \[(?P<level>[^\]]*)\](?: \[pid (?P<pid>[^:\]]*)(:[^\]]+)*\])? \[client (?P<client>[^\]]*)\] (?P<message>.*)$`),
	ApacheAccessMimeType: regexp.MustCompile(`^(?P<host>[^ ]*) [^ ]* (?P<user>[^ ]*) \[(?P<time>[^\]]*)\] "(?P<method>\S+)(?: +(?P<path>(?:[^\"]|\.)*?)(?: +\S*)?)?" (?P<code>[^ ]*) (?P<size>[^ ]*)(?: "(?P<referer>(?:[^\"]|\.)*)" "(?P<agent>(?:[^\"]|\.)*)")?$`),
	NginxAccessMimeType:  regexp.MustCompile(`^(?P<remote>[^ ]*) (?P<host>[^ ]*) (?P<user>[^ ]*) \[(?P<time>[^\]]*)\] "(?P<method>\S+)(?: +(?P<path>[^\"]*?)(?: +\S*)?)?" (?P<code>[^ ]*) (?P<size>[^ ]*)(?: "(?P<referer>[^\"]*)" "(?P<agent>[^\"]*)"(?:\s+(?P<http_x_forwarded_for>[^ ]+))?)?$`),
}

func transformRegexp(in *bufio.Reader, out *bufio.Writer, re *regexp.Regexp) error {
	scanner := newLargeLineScanner(in)
	return withJSONArrayOutWriterFile(out, func(w *jsonutil.StreamEncoder) error {
		row := map[string]any{}
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

			err := w.EncodeRow(row)
			if err != nil {
				return err
			}
		}

		return scanner.Err()
	})
}

func transformRegexpFile(in string, out *bufio.Writer, re *regexp.Regexp) error {
	r, closeFile, err := openBufferedFile(in)
	if err != nil {
		return err
	}
	defer closeFile()

	return transformRegexp(r, out, re)
}

func transformAvro(in *bufio.Reader, out *bufio.Writer) error {
	ocfr, err := goavro.NewOCFReader(in)
	if err != nil {
		return err
	}

	return withJSONArrayOutWriterFile(out, func(w *jsonutil.StreamEncoder) error {
		for ocfr.Scan() {
			r, err := ocfr.Read()
			if err != nil {
				return err
			}

			if err := w.EncodeRow(r); err != nil {
				return err
			}
		}

		return ocfr.Err()
	})
}

func transformAvroFile(in string, out *bufio.Writer) error {
	r, closeFile, err := openBufferedFile(in)
	if err != nil {
		return err
	}
	defer closeFile()

	return transformAvro(r, out)
}

type MimeType string

const (
	TSVMimeType             MimeType = "text/tab-separated-values"
	PlainTextMimeType                = "text/plain"
	CSVMimeType                      = "text/csv"
	JSONMimeType                     = "application/json"
	JSONLinesMimeType                = "application/jsonlines"
	JSONConcatMimeType               = "application/jsonconcat"
	RegexpLinesMimeType              = "text/regexplines"
	ExcelMimeType                    = "application/vnd.ms-excel"
	ExcelOpenXMLMimeType             = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	OpenOfficeSheetMimeType          = "application/vnd.oasis.opendocument.spreadsheet"
	ParquetMimeType                  = "parquet"
	ORCMimeType                      = "orc"
	AvroMimeType                     = "application/avro"
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
	case ".txt":
		return PlainTextMimeType
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
	case ".orc":
		return ORCMimeType
	case ".avro":
		return AvroMimeType
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

func TransformFile(fileName string, cti ContentTypeInfo, out *bufio.Writer) error {
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
	case ORCMimeType:
		return transformORCFile(fileName, out)
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
	case AvroMimeType:
		return transformAvroFile(fileName, out)
	}

	if re, ok := BUILTIN_REGEX[assumedType]; ok {
		return transformRegexpFile(fileName, out, re)
	}

	return transformGenericFile(fileName, out)
}

func (ec EvalContext) evalFilePanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	cti := panel.File.ContentTypeInfo
	fileName := panel.File.Name
	server, err := getServer(project, panel.ServerId)
	if err != nil {
		return err
	}

	out := ec.GetPanelResultsFile(project.Id, panel.Id)
	w, closeFile, err := openTruncateBufio(out)
	if err != nil {
		return err
	}
	defer closeFile()
	defer w.Flush()

	if server != nil {
		// Resolve ~ to foreign home path.
		// Will break if the server is not Linux.
		fileName = strings.ReplaceAll(fileName, "~", "/home/"+server.Username)

		return ec.remoteFileReader(*server, fileName, func(r *bufio.Reader) error {
			return TransformReader(r, fileName, cti, w)
		})
	}

	fileName = resolvePath(fileName)

	return TransformFile(fileName, cti, w)
}

func resolvePath(p string) string {
	if !strings.HasPrefix(p, "~/") {
		return p
	}

	return path.Join(HOME, p[2:])
}
