package runner

import (
	"bufio"
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/multiprocessio/go-openoffice"
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
// Not the most beautiful code, but it is well tested.
func getHTTPHostPort(raw string) (bool, string, string, string, error) {
	if len(raw) == 0 {
		return false, "", "", "", makeErrUser("URL must not be blank.")
	}

	// Handle shorthand like `curl /xyz` meaning `curl http://localhost:80/xyz`
	if raw[0] == '/' {
		return false, "localhost", "80", raw, nil
	}

	// Handle fully formed urls that include protocol
	if strings.HasPrefix(raw, "https://") || strings.HasPrefix(raw, "http://") {
		u, err := url.Parse(raw)
		if err != nil {
			return false, "", "", "", edsef("Could not parse HTTP address: %s", err)
		}

		_, _, err = net.SplitHostPort(u.Host)
		if err != nil && strings.HasSuffix(err.Error(), "missing port in address") {
			if u.Scheme == "https" {
				u.Host += ":443"
			} else {
				u.Host += ":80"
			}
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
		return false, "", "", "", edsef("Could not parse HTTP address: %s", err)
	}

	_, _, err = net.SplitHostPort(u.Host)
	if err != nil && strings.HasSuffix(err.Error(), "missing port in address") {
		if u.Scheme == "https" {
			u.Host += ":443"
		} else {
			u.Host += ":80"
		}
	}

	host, port, err := net.SplitHostPort(u.Host)
	if err != nil {
		return false, "", "", "", edsef("Could not split host-port: %s", err)
	}

	// Don't override to http above if the port is 443
	if port == "443" {
		u.Scheme = "https"
	}

	return u.Scheme == "https", host, port, fullPath(u), err
}

func makeHTTPUrl(tls bool, host, port, extra string) string {
	url := "http://"
	if tls {
		url = "https://"
	}
	return url + host + ":" + port + extra
}

type httpRequest struct {
	url           string
	headers       []HttpConnectorInfoHeader
	body          []byte
	sendBody      bool
	method        string
	customCaCerts []string
	allowInsecure bool
}

func getTransport(customCaCerts []string) (*http.Transport, error) {
	rootCAs, err := x509.SystemCertPool()
	if err != nil {
		Logln("Failed to get system certs: %s", err)
		// Continue with empty pool
		rootCAs = x509.NewCertPool()
	}

	for _, customCaCert := range customCaCerts {
		f := strings.TrimSpace(customCaCert)
		if f == "" {
			continue
		}

		cert, err := ioutil.ReadFile(f)
		if err != nil {
			return nil, edsef("Could not add custom CA cert: %s", err)
		}

		if ok := rootCAs.AppendCertsFromPEM(cert); !ok {
			Logln("Failed to add custom CA cert: %s", f)
		}
	}

	config := &tls.Config{RootCAs: rootCAs}
	return &http.Transport{TLSClientConfig: config}, nil
}

func makeHTTPRequest(hr httpRequest) (*http.Response, error) {
	var req *http.Request
	var err error
	// Convoluted logic to not pass in a typed nil
	// https://github.com/golang/go/issues/32897
	if hr.sendBody {
		req, err = http.NewRequest(hr.method, hr.url, bytes.NewBuffer(hr.body))
	} else {
		req, err = http.NewRequest(hr.method, hr.url, nil)
	}
	if err != nil {
		return nil, err
	}

	for _, header := range hr.headers {
		req.Header.Set(header.Name, header.Value)
	}

	tr, err := getTransport(hr.customCaCerts)
	if err != nil {
		return nil, err
	}
	if hr.allowInsecure {
		tr.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}
	c := http.Client{Timeout: time.Second * 15, Transport: tr}
	return c.Do(req)
}

func (ec EvalContext) evalHTTPPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	server, err := getServer(project, panel.ServerId)
	if err != nil {
		return err
	}

	h := panel.Http.Http

	h.Url, err = ec.evalMacros(h.Url, project, pageIndex)
	if err != nil {
		return err
	}

	for _, header := range h.Headers {
		header.Value, err = ec.evalMacros(header.Value, project, pageIndex)
		if err != nil {
			return err
		}
	}

	tls, host, port, rest, err := getHTTPHostPort(h.Url)
	if err != nil {
		return err
	}

	var customCaCerts []string
	for _, caCert := range ec.settings.CaCerts {
		customCaCerts = append(customCaCerts, caCert.File)
	}

	return ec.withRemoteConnection(server, host, port, func(proxyHost, proxyPort string) error {
		url := makeHTTPUrl(tls, proxyHost, proxyPort, rest)
		rsp, err := makeHTTPRequest(httpRequest{
			allowInsecure: h.AllowInsecure,
			url:           url,
			headers:       h.Headers,
			body:          []byte(panel.Content),
			sendBody: panel.Content != "" &&
				(h.Method == http.MethodPut || h.Method == http.MethodPatch || h.Method == http.MethodPost),
			customCaCerts: customCaCerts,
			method:        h.Method,
		})
		if err != nil {
			return err
		}
		defer rsp.Body.Close()

		if h.ContentTypeInfo.Type == "" {
			headerContentType := rsp.Header.Get("content-type")
			// These are two generic, better to depend on file name in this case.
			if headerContentType != "application/octet-stream" &&
				headerContentType != "text/plain" {
				h.ContentTypeInfo.Type = headerContentType
			}

		}

		out := ec.GetPanelResultsFile(project.Id, panel.Id)
		w, err := openTruncate(out)
		if err != nil {
			return err
		}
		defer w.Close()

		b := bufio.NewWriterSize(w, 4096*20)
		defer b.Flush()

		rb := bufio.NewReaderSize(rsp.Body, 4096*20)

		return TransformReader(rb, url, h.ContentTypeInfo, b)
	})
}

func TransformReader(r *bufio.Reader, fileName string, cti ContentTypeInfo, out *bufio.Writer) error {
	assumedType := GetMimeType(fileName, cti)
	Logln("Assumed '%s' from '%s' given '%s'", assumedType, cti.Type, fileName)

	switch assumedType {
	case JSONMimeType:
		return transformJSON(r, out)
	case CSVMimeType:
		return transformCSV(r, out, ',')
	case TSVMimeType:
		return transformCSV(r, out, '\t')
	case ExcelMimeType, ExcelOpenXMLMimeType:
		r, err := excelize.OpenReader(r)
		if err != nil {
			return err
		}
		return transformXLSX(r, out)
	case ParquetMimeType:
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
	case ORCMimeType:
		w, err := ioutil.TempFile("", "http-orc-temp")
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

		return transformORCFile(w.Name(), out)
	case AvroMimeType:
		return transformAvroFile(fileName, out)
	case RegexpLinesMimeType:
		// There are probably weird cases this won't work but
		// let's wait for a bug report to do more intelligent
		// translation of JavaScript -> Go regexp.
		goRegexp := strings.ReplaceAll(cti.CustomLineRegexp, "(?<", "(?P<")
		return transformRegexp(r, out, regexp.MustCompile(goRegexp))
	case JSONLinesMimeType:
		return transformJSONLines(r, out)
	case JSONConcatMimeType:
		return transformJSONConcat(r, out)
	case OpenOfficeSheetMimeType:
		buf := bytes.NewBuffer(nil)
		size, err := io.Copy(buf, r)
		if err != nil {
			return edse(err)
		}

		oor, err := openoffice.NewODSReader(bytes.NewReader(buf.Bytes()), size)
		if err != nil {
			return edse(err)
		}
		return transformOpenOfficeSheet(oor, out)
	}

	if re, ok := BUILTIN_REGEX[assumedType]; ok {
		return transformRegexp(r, out, re)
	}

	Logln("Unknown format '%s' from '%s' given '%s', transforming as string", assumedType, cti.Type, fileName)
	return transformGeneric(r, out)
}
