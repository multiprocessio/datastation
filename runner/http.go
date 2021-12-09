package main

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"

	"github.com/xuri/excelize/v2"
)

func evalHttpPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	h := panel.Http.Http
	var req *http.Request
	var err error
	// Convoluted logic to not pass in a typed nil
	// https://github.com/golang/go/issues/32897
	if panel.Content != "" && h.Method != "GET" {
		req, err = http.NewRequest(h.Method, h.Url, bytes.NewBuffer([]byte(panel.Content)))
	} else {
		req, err = http.NewRequest(h.Method, h.Url, nil)
	}
	if err != nil {
		return err
	}

	for _, header := range h.Headers {
		req.Header.Set(header[0], header[1])
	}

	client := &http.Client{}
	rsp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer rsp.Body.Close()

	assumedType := getMimeType(h.Url, h.ContentTypeInfo)
	if assumedType == "" {
		return fmt.Errorf("Unknown type")
	}

	out := getPanelResultsFile(project.ProjectName, panel.Id)

	switch assumedType {
	case "application/json":
		return transformJSON(rsp.Body, out)
	case "text/csv":
		return transformCSV(rsp.Body, out)
	case "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		r, err := excelize.OpenReader(rsp.Body)
		if err != nil {
			return err
		}
		return transformXLSX(r, out)
	case "parquet":
		file, err := ioutil.TempFile("", "http-parquet-temp")
		if err != nil {
			return err
		}
		defer os.Remove(file.Name())

		return transformParquetFile(file.Name(), out)
	}

	return fmt.Errorf("Unsupported type " + assumedType)
}
