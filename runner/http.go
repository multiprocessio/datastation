package main

import (
	"bytes"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"regexp"

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
	log.Printf("Assumed '%s' from '%s' given '%s' when loading file", assumedType, h.ContentTypeInfo.Type, h.Url)

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
		w, err := ioutil.TempFile("", "http-parquet-temp")
		if err != nil {
			return err
		}
		defer os.Remove(w.Name())

		_, err = w.ReadFrom(rsp.Body)
		if err == io.EOF {
			err = nil
		}
		if err != nil {
			return err
		}

		return transformParquetFile(w.Name(), out)
	case "text/regexplines":
		return transformRegexp(rsp.Body, out, regexp.MustCompile(h.ContentTypeInfo.CustomLineRegexp))
	}

	if re, ok := BUILTIN_REGEX[assumedType]; ok {
		return transformRegexp(rsp.Body, out, re)
	}

	return transformGeneric(rsp.Body, out)
}
