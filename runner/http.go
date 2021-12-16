package main

import (
	"bytes"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"net"
	"os"
	"regexp"
	"strings"

	"github.com/xuri/excelize/v2"
)

func fullPath(u *url.URL) string {
	p := u.Path
	if u.RawQuery != "" {
		p += "?" + u.RawQuery
	}

	if u.Fragment != "" {
		p += "#" + u.Fragment
	}

	return p
}

// Returns: protocol, address, port
func getHTTPHostPort(raw string) (bool, string, string, string, error) {
	// Handle shorthand like `curl /xyz` meaning `curl http://localhost:80/xyz`
	if raw[0] == '/' {
		return true, "localhost", "80", raw, nil
	}

	// Handle fully formed urls that include protocol
	if strings.HasPrefix(raw, "https://") || strings.HasPrefix(raw, "http://") {
		u, err := url.Parse(raw)
		if err != nil {
			return false, "", "", "", edsef("Could not parse HTTP address: %s", err)
		}

		host, port, err := net.SplitHostPort(u.Host)
		if err != nil {
			return false, "", "", "", edsef("Could not split host-port: %s", err)
		}

		return u.Scheme == "https", host, port, fullPath(u), err
	}

	// Handle shorthand like `curl :93/xyz` meaning `curl http://localhost:93/xyz`
	if raw[0] == ':' {
		raw = "localhost" + raw
	}

	raw = "http://" + raw
	u, err := url.Parse(raw)
	if err != nil {
		return false,"", "", "", edsef("Could not parse HTTP address: %s", err)
	}

	host, port, err := net.SplitHostPort(u.Host)
	if err != nil {
		return false, "","", "", edsef("Could not split host-port: %s", err)
	}

	// Don't override to http above if the port is 443
	if port == "443" {
		u.Scheme = "https"
	}

	return u.Scheme == "https", host, port, fullPath(u), err
}

func evalHttpPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	server, err := getServer(project, panel.ServerId)
	if err != nil {
		return err
	}

	tls, host, port, rest, err := getHTTPHostPort(panel.HttpPanelInfo.Http.Http.Url)
	if err != nil {
		return err
	}

	return withRemoteConnection(server, host, port, func(host, port string) error {
		h := panel.Http.Http

		url := "http://"
		if tls {
			url = "https://"
		}
		url += host + ":" + port + rest
		var req *http.Request
		var err error
		// Convoluted logic to not pass in a typed nil
		// https://github.com/golang/go/issues/32897
		if panel.Content != "" && h.Method != "GET" {
			req, err = http.NewRequest(h.Method, url, bytes.NewBuffer([]byte(panel.Content)))
		} else {
			req, err = http.NewRequest(h.Method, url, nil)
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
		return transformReader(rsp.Body, url, h.ContentTypeInfo, out)
	})
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
		// There are probably weird cases this won't work but
		// let's wait for a bug report to do more intelligent
		// translation of JavaScript -> Go regexp.
		goRegexp := strings.ReplaceAll(cti.CustomLineRegexp, "(?<", "(?P<")
		return transformRegexp(r, out, regexp.MustCompile(goRegexp))
	case "application/jsonlines":
		return transformJSONLines(r, out)
	}

	if re, ok := BUILTIN_REGEX[assumedType]; ok {
		return transformRegexp(r, out, re)
	}

	return transformGeneric(r, out)
}
