package main

import (
	"bytes"
	"io"
	"io/ioutil"
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

	out := getPanelResultsFile(project.Id, panel.Id)
	return transformReader(rsp.Body, h.Url, h.ContentTypeInfo, out)
}

func transformReader(r io.Reader, fileName string, cti ContentTypeInfo, out string) error {
	assumedType := getMimeType(fileName, cti)
	logln("Assumed '%s' from '%s' given '%s' when loading file", assumedType, cti.Type, fileName)

	switch assumedType {
	case "application/json":
		return transformJSON(r, out)
	case "text/csv":
		return transformCSV(r, out)
	case "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		r, err := excelize.OpenReader(r)
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

		_, err = w.ReadFrom(r)
		if err == io.EOF {
			err = nil
		}
		if err != nil {
			return err
		}

		return transformParquetFile(w.Name(), out)
	case "text/regexplines":
		return transformRegexp(r, out, regexp.MustCompile(cti.CustomLineRegexp))
	case "text/jsonlines":
		return transformJSONLines(r, out)
	}

	if re, ok := BUILTIN_REGEX[assumedType]; ok {
		return transformRegexp(r, out, re)
	}

	return transformGeneric(r, out)
}
