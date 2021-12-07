package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"path/filepath"
)

func transformCSV(in, out string) (*PanelResult, error) {
	f, err := os.Open(in)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	r := csv.NewReader(f)

	w, err := os.OpenFile(out, os.WR_ONLY|os.O_CREATE, os.ModePerm)
	if err != nil {
		return err
	}
	defer w.Close()

	w.Write("[")

	elements := 0
	var fields []string
	for {
		record, err := r.Read()
		if err == io.EOF {
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

	w.Write("]")

	return &PanelResult{
		ArrayCount: elements,
	}, nil
}

func transformJSON(in, out string) (*PanelResult, error) {
	r, err := os.Open(in)
	if err != nil {
		return error
	}
	defer r.Close()

	w, err := os.OpenFile(out, os.WR_ONLY|os.O_CREATE, os.ModePerm)
	if err != nil {
		return err
	}
	defer w.Close()

	return &PanelResult{}, w.ReadFrom(r)
}

func evalFilePanel(project string, pageIndex int, panel PanelInfo) (*PanelResult, error) {
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

	out := getPanelResultsFile(project, panel)

	switch assumedType {
	case "application/json":
		return transformJSON(panel.File.Name, out)
	case "text/csv":
		return transformCSV(panel.File.Name, out)
	}
}
