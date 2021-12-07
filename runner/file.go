package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

func transformCSV(in io.Reader, out string) error {
	r := csv.NewReader(in)

	w, err := os.OpenFile(out, os.O_WRONLY|os.O_CREATE, os.ModePerm)
	if err != nil {
		return err
	}
	defer w.Close()

	_, err = w.Write([]byte("["))
	if err != nil {
		return err
	}

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

		encoder := json.NewEncoder(w)
		err = encoder.Encode(row)
		if err != nil {
			return err
		}

		w.Write([]byte(","))
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
	return err
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
		case "csv":
			assumedType = "text/csv"
		case "json":
			assumedType = "application/json"
		}
	}

	if assumedType == "" {
		return fmt.Errorf("Unknown type")
	}

	out := getPanelResultsFile(project.ProjectName, panel)

	switch assumedType {
	case "application/json":
		return transformJSONFile(panel.File.Name, out)
	case "text/csv":
		return transformCSVFile(panel.File.Name, out)
	}

	return fmt.Errorf("Unsupported type " + assumedType)
}
