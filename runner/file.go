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

	"github.com/multiprocessio/go-openoffice"
	"gopkg.in/yaml.v3"

	"github.com/linkedin/goavro/v2"
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

func transformCSV(in *bufio.Reader, out *ResultWriter, delimiter rune, convertNumbers bool) error {
	r := csv.NewReader(in)
	r.Comma = delimiter
	r.ReuseRecord = true
	r.FieldsPerRecord = -1

	isHeader := true

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
			out.SetFields(record)
			isHeader = false
			continue
		}

		err = out.WriteRecord(record, convertNumbers)
		if err != nil {
			return err
		}
	}

	return nil
}

func transformCSVFile(in string, out *ResultWriter, delimiter rune, convertNumbers bool) error {
	r, closeFile, err := openBufferedFile(in)
	if err != nil {
		return err
	}
	defer closeFile()

	return transformCSV(r, out, delimiter, convertNumbers)
}

func transformJSON(in *bufio.Reader, out *ResultWriter) error {
	jw := out.w.(*JSONResultItemWriter)
	jw.raw = true
	o := jw.bfd
	_, err := io.Copy(o, in)
	if err == io.EOF {
		err = nil
	}

	return err
}

func transformJSONFile(in string, out *ResultWriter) error {
	r, closeFile, err := openBufferedFile(in)
	if err != nil {
		return err
	}
	defer closeFile()

	return transformJSON(r, out)
}

func transformParquet(in source.ParquetFile, out *ResultWriter) error {
	r, err := reader.NewParquetReader(in, nil, int64(preferredParallelism))
	if err != nil {
		return err
	}
	defer r.ReadStop()

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
			// Structs need to be turned into map[string]any if this is not the JSON writer
			if _, ok := out.w.(*JSONResultItemWriter); !ok {
				bs, err := jsonMarshal(row)
				if err != nil {
					return err
				}

				err = jsonUnmarshal(bs, &row)
				if err != nil {
					return err
				}
			}

			err := out.WriteRow(row)
			if err != nil {
				return err
			}
		}

		offset += int64(size)

		if len(rows) < size {
			return nil
		}
	}

	return nil
}

func transformParquetFile(in string, out *ResultWriter) error {
	r, err := local.NewLocalFileReader(in)
	if err != nil {
		return err
	}
	defer r.Close()

	return transformParquet(r, out)
}

func transformORC(in *orc.Reader, out *ResultWriter) error {
	cols := in.Schema().Columns()
	c := in.Select(cols...)

	out.SetFields(cols)

	for c.Stripes() {
		for c.Next() {
			r := c.Row()

			err := out.WriteAnyRecord(r, false)
			if err != nil {
				return err
			}
		}
	}

	return c.Err()
}

func transformORCFile(in string, out *ResultWriter) error {
	r, err := orc.Open(in)
	if err != nil {
		return err
	}
	defer r.Close()

	return transformORC(r, out)
}

func writeSheet(rows [][]string, out *ResultWriter) error {
	isHeader := true
	for _, r := range rows {
		if isHeader {
			out.SetFields(r)
			isHeader = false
			continue
		}

		err := out.WriteRecord(r, false)
		if err != nil {
			return err
		}
	}

	return nil
}

func transformXLSX(in *excelize.File, out *ResultWriter) error {
	sheets := in.GetSheetList()

	// Single sheet files get flattened into just an array, not a dict mapping sheet name to sheet contents
	if len(sheets) == 1 {
		rows, err := in.GetRows(sheets[0])
		if err != nil {
			return err
		}

		return writeSheet(rows, out)
	}

	for _, sheet := range sheets {
		rows, err := in.GetRows(sheet)
		if err != nil {
			return err
		}

		out.SetNamespace(sheet)
		err = writeSheet(rows, out)
		if err != nil {
			return err
		}
	}

	return nil
}

func transformXLSXFile(in string, out *ResultWriter) error {
	f, err := excelize.OpenFile(in)
	if err != nil {
		return err
	}

	return transformXLSX(f, out)
}

func transformOpenOfficeSheet(in *openoffice.ODSFile, out *ResultWriter) error {
	doc, err := in.ParseContent()
	if err != nil {
		return edse(err)
	}

	// Single sheet files get flattened into just an array, not a dict mapping sheet name to sheet contents
	if len(doc.Sheets) == 1 {
		return writeSheet(doc.Sheets[0].Strings(), out)
	}

	for _, sheet := range doc.Sheets {
		out.SetNamespace(sheet.Name)
		err = writeSheet(sheet.Strings(), out)
		if err != nil {
			return err
		}
	}

	return nil
}

func transformOpenOfficeSheetFile(in string, out *ResultWriter) error {
	f, err := openoffice.OpenODS(in)
	if err != nil {
		return edse(err)
	}

	return transformOpenOfficeSheet(f, out)
}

func transformGeneric(r *bufio.Reader, out *ResultWriter) error {
	jw := out.w.(*JSONResultItemWriter)
	jw.raw = true
	o := jw.bfd
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

func transformGenericFile(in string, out *ResultWriter) error {
	r, closeFile, err := openBufferedFile(in)
	if err != nil {
		return err
	}
	defer closeFile()

	return transformGeneric(r, out)
}

func transformJSONLines(in *bufio.Reader, out *ResultWriter) error {
	dec := jsonNewDecoder(in)
	for {
		var a any
		err := dec.Decode(&a)
		if err == io.EOF {
			break
		}

		if err != nil {
			return err
		}

		err = out.WriteRow(a)
		if err != nil {
			return err
		}
	}

	return nil
}

func transformJSONLinesFile(in string, out *ResultWriter) error {
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

func newLargeLineScanner(in *bufio.Reader) *bufio.Scanner {
	scanner := bufio.NewScanner(in)

	// Bump line length limit to 1MB (from 64k)
	buf := make([]byte, 4096)
	scanner.Buffer(buf, 1024*1024)
	return scanner
}

func transformRegexp(in *bufio.Reader, out *ResultWriter, re *regexp.Regexp) error {
	scanner := newLargeLineScanner(in)

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

		err := out.WriteRow(row)
		if err != nil {
			return err
		}
	}

	return scanner.Err()
}

func transformRegexpFile(in string, out *ResultWriter, re *regexp.Regexp) error {
	r, closeFile, err := openBufferedFile(in)
	if err != nil {
		return err
	}
	defer closeFile()

	return transformRegexp(r, out, re)
}

func transformAvro(in *bufio.Reader, out *ResultWriter) error {
	ocfr, err := goavro.NewOCFReader(in)
	if err != nil {
		return err
	}

	for ocfr.Scan() {
		r, err := ocfr.Read()
		if err != nil {
			return err
		}

		if err := out.WriteRow(r); err != nil {
			return err
		}
	}

	return ocfr.Err()
}

func transformAvroFile(in string, out *ResultWriter) error {
	r, closeFile, err := openBufferedFile(in)
	if err != nil {
		return err
	}
	defer closeFile()

	return transformAvro(r, out)
}

func transformYAML(in *bufio.Reader, out *ResultWriter) error {
	dec := yaml.NewDecoder(in)

	var first, next any
	err := dec.Decode(&first)
	if err != nil {
		return err
	}

	// If EOF after first doc, write JSON directly like {"a": "b"}
	nextErr := dec.Decode(&next)
	if nextErr == io.EOF {
		jw := out.w.(*JSONResultItemWriter)
		jw.raw = true
		o := jw.bfd
		enc := jsonNewEncoder(o)

		return enc.Encode(&first)
	}

	// In the case of multiple docs (separated by ---), write them as rows like [{"a": "b"}, {"c": "d"}]
	if err := out.WriteRow(first); err != nil {
		return err
	}
	if err := out.WriteRow(next); err != nil {
		return err
	}

	for {
		var a any
		err := dec.Decode(&a)
		if err == io.EOF {
			return nil
		}

		if err != nil {
			return err
		}

		if err := out.WriteRow(a); err != nil {
			return err
		}
	}
}

func transformYAMLFile(in string, out *ResultWriter) error {
	r, closeFile, err := openBufferedFile(in)
	if err != nil {
		return err
	}

	defer closeFile()

	return transformYAML(r, out)
}

type MimeType string

const (
	TSVMimeType             MimeType = "text/tab-separated-values"
	PlainTextMimeType                = "text/plain"
	CSVMimeType                      = "text/csv"
	JSONMimeType                     = "application/json"
	JSONLinesMimeType                = "application/jsonlines"
	RegexpLinesMimeType              = "text/regexplines"
	ExcelMimeType                    = "application/vnd.ms-excel"
	ExcelOpenXMLMimeType             = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	OpenOfficeSheetMimeType          = "application/vnd.oasis.opendocument.spreadsheet"
	ParquetMimeType                  = "parquet"
	ORCMimeType                      = "orc"
	AvroMimeType                     = "application/avro"
	YAMLMimeType                     = "application/yaml"
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
	case ".jsonl", ".ndjson", ".cjson":
		return JSONLinesMimeType
	case ".xls", ".xlsx", ".xlsm":
		return ExcelMimeType
	case ".ods":
		return OpenOfficeSheetMimeType
	case ".parquet":
		return ParquetMimeType
	case ".orc":
		return ORCMimeType
	case ".avro":
		return AvroMimeType
	case ".yaml", ".yml":
		return YAMLMimeType
	}

	return UnknownMimeType
}

func TransformFile(fileName string, cti ContentTypeInfo, out *ResultWriter) error {
	assumedType := GetMimeType(fileName, cti)

	Logln("Assumed '%s' from '%s' given '%s' when loading file", assumedType, cti.Type, fileName)
	switch assumedType {
	case JSONMimeType:
		return transformJSONFile(fileName, out)
	case CSVMimeType:
		return transformCSVFile(fileName, out, ',', cti.ConvertNumbers)
	case TSVMimeType:
		return transformCSVFile(fileName, out, '\t', cti.ConvertNumbers)
	case ExcelMimeType, ExcelOpenXMLMimeType:
		return transformXLSXFile(fileName, out)
	case ParquetMimeType:
		return transformParquetFile(fileName, out)
	case ORCMimeType:
		return transformORCFile(fileName, out)
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
	case YAMLMimeType:
		return transformYAMLFile(fileName, out)
	}

	if re, ok := BUILTIN_REGEX[assumedType]; ok {
		return transformRegexpFile(fileName, out, re)
	}

	return transformGenericFile(fileName, out)
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

func (ec EvalContext) evalFilePanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	cti := panel.File.ContentTypeInfo
	fileName := panel.File.Name
	server, err := getServer(project, panel.ServerId)
	if err != nil {
		return err
	}

	rw, err := ec.GetResultWriter(project.Id, panel.Id)
	if err != nil {
		return err
	}
	defer rw.Close()

	if server != nil {
		// Resolve ~ to foreign home path.
		// Will break if the server is not Linux.
		if strings.HasPrefix(fileName, "~/") {
			fileName = path.Join("/home", server.Username, fileName[2:])
		}

		return ec.remoteFileReader(*server, fileName, func(r *bufio.Reader) error {
			return TransformReader(r, fileName, cti, rw)
		})
	}

	fileName = resolvePath(fileName)
	return TransformFile(fileName, cti, rw)
}

func resolvePath(p string) string {
	if !strings.HasPrefix(p, "~/") {
		return p
	}

	return path.Join(HOME, p[2:])
}
