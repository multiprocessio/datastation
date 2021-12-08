package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
)

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

func withJSONArrayOutWriter(out string, cb func(w JSONArrayWriter) error) error {
	w, err := os.OpenFile(out, os.O_WRONLY|os.O_CREATE, os.ModePerm)
	if err != nil {
		return err
	}
	defer w.Close()

	_, err = w.Write([]byte("["))
	if err != nil {
		return err
	}

	err = cb(JSONArrayWriter{w})
	if err != nil {
		return err
	}

	// Find current offset
	lastChar, err := w.Seek(0, io.SeekCurrent)
	if err != nil {
		return err
	}

	if lastChar > 1 {
		// Overwrite the last comma
		lastChar = lastChar - 1
	}

	_, err = w.WriteAt([]byte("]"), lastChar)
	if err != nil {
		return err
	}

	return w.Truncate(lastChar + 1)
}

func transformCSV(in io.Reader, out string) error {
	r := csv.NewReader(in)

	return withJSONArrayOutWriter(out, func(w JSONArrayWriter) error {
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

func evalFilePanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	assumedType := panel.File.ContentTypeInfo.Type
	if assumedType == "" {
		switch filepath.Ext(panel.File.Name) {
		case ".csv":
			assumedType = "text/csv"
		case ".json":
			assumedType = "application/json"
		}
	}

	if assumedType == "" {
		return fmt.Errorf("Unknown type")
	}

	out := getPanelResultsFile(project.ProjectName, panel.Id)

	switch assumedType {
	case "application/json":
		return transformJSONFile(panel.File.Name, out)
	case "text/csv":
		return transformCSVFile(panel.File.Name, out)
	}

	return fmt.Errorf("Unsupported type " + assumedType)
}
