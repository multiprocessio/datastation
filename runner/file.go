package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
)

func transformCSV(in io.Reader, out string) (*PanelResult, error) {
	r := csv.NewReader(in)

	w, err := os.OpenFile(out, os.O_WRONLY|os.O_CREATE, os.ModePerm)
	if err != nil {
		return nil, err
	}
	defer w.Close()

	_, err = w.Write([]byte("["))
	if err != nil {
		return nil, err
	}

	elements := 0
	var fields []string
	for {
		record, err := r.Read()
		if err == io.EOF {
			err = nil
			break
		}

		if err != nil {
			return nil, err
		}

		if elements == 0 {
			for _, field := range record {
				fields = append(fields, field)
			}
			continue
		}

		elements += 1
		row := map[string]string{}
		for i, field := range fields {
			row[field] = record[i]
		}

		encoder := json.NewEncoder(w)
		err = encoder.Encode(row)
		if err != nil {
			return nil, err
		}
	}

	_, err = w.Write([]byte("]"))
	if err != nil {
		return nil, err
	}

	arrayCount := float64(elements)
	return &PanelResult{
		ArrayCount: &arrayCount,
	}, nil
}

func transformCSVFile(in, out string) (*PanelResult, error) {
	f, err := os.Open(in)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	return transformCSV(f, out)
}

func transformJSON(in io.Reader, out string) (*PanelResult, error) {
	w, err := os.OpenFile(out, os.O_WRONLY|os.O_CREATE, os.ModePerm)
	if err != nil {
		return nil, err
	}
	defer w.Close()

	_, err = w.ReadFrom(in)
	if err == io.EOF {
		err = nil
	}
	log.Println("HEY PHIL IM HERE", err)

	return &PanelResult{}, err
}

func transformJSONFile(in, out string) (*PanelResult, error) {
	r, err := os.Open(in)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	return transformJSON(r, out)
}

func evalFilePanel(project *ProjectState, pageIndex int, panel *PanelInfo) (*PanelResult, error) {
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
		return nil, fmt.Errorf("Unknown type")
	}

	out := getPanelResultsFile(project.ProjectName, panel)

	switch assumedType {
	case "application/json":
		return transformJSONFile(panel.File.Name, out)
	case "text/csv":
		return transformCSVFile(panel.File.Name, out)
	}

	return nil, fmt.Errorf("Unsupported type " + assumedType)
}
