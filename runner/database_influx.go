package runner

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/url"

	"github.com/multiprocessio/go-json"

	"github.com/influxdata/influxdb-client-go/v2"
)

type influxSeries struct {
	Values  [][]interface{} `json:"values"`
	Columns []string        `json:"columns"`
	Name    string          `json:"name"`
}

type influxResult struct {
	Series []influxSeries `json:"series"`
}

type influxResponse struct {
	Results []influxResult `json:"results"`
}

// InfluxQL is supported in 1 and 2 but requires special setup in 2.
// See https://docs.influxdata.com/influxdb/v2.1/query-data/influxql/#verify-buckets-have-a-mapping
func (ec EvalContext) evalInfluxQL(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w io.Writer) error {
	tls, host, port, _, err := getHTTPHostPort(dbInfo.Address)
	if err != nil {
		return err
	}

	password, err := dbInfo.Password.decrypt()
	if err != nil {
		return err
	}

	token, err := dbInfo.ApiKey.decrypt()
	if err != nil {
		return err
	}

	return withRemoteConnection(server, host, port, func(proxyHost, proxyPort string) error {
		params := url.Values{}
		params.Add("q", panel.Content)
		params.Add("db", dbInfo.Database)
		u := makeHTTPUrl(tls, proxyHost, proxyPort, "/query?"+params.Encode())

		var headers []HttpConnectorInfoHeader
		if password != "" {
			headers = append(headers, HttpConnectorInfoHeader{
				Name:  "Authorization",
				Value: "Basic " + base64.StdEncoding.EncodeToString([]byte(dbInfo.Username+":"+password)),
			})
		} else if token != "" {
			headers = append(headers, HttpConnectorInfoHeader{
				Name:  "Authorization",
				Value: "Token " + base64.StdEncoding.EncodeToString([]byte(token)),
			})
		}

		var customCaCerts []string
		for _, c := range ec.settings.CaCerts {
			customCaCerts = append(customCaCerts, c.File)
		}
		rsp, err := makeHTTPRequest(httpRequest{
			url:           u,
			method:        "GET",
			headers:       headers,
			customCaCerts: customCaCerts,
		})
		if err != nil {
			return err
		}
		defer rsp.Body.Close()

		if rsp.StatusCode >= 400 {
			b, _ := io.ReadAll(rsp.Body)
			return makeErrUser(string(b))
		}

		var r influxResponse
		err = json.NewDecoder(rsp.Body).Decode(&r)
		if err != nil {
			return err
		}

		return withJSONArrayOutWriterFile(w, func(w *jsonutil.StreamEncoder) error {
			for _, result := range r.Results {
				for _, series := range result.Series {
					for _, r := range series.Values {
						row := map[string]interface{}{
							"__series_name__": series.Name,
						}
						for i, cell := range r {
							row[series.Columns[i]] = cell
						}

						err := w.EncodeRow(row)
						if err != nil {
							return err
						}
					}
				}
			}

			return nil
		})
	})
}

// Flux language is only supported in influx2.
func evalFlux(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w io.Writer) error {
	tls, host, port, rest, err := getHTTPHostPort(dbInfo.Address)
	if err != nil {
		return err
	}

	token, err := dbInfo.ApiKey.decrypt()
	if err != nil {
		return err
	}

	return withRemoteConnection(server, host, port, func(proxyHost, proxyPort string) error {
		url := makeHTTPUrl(tls, proxyHost, proxyPort, rest)

		// TODO: support custom certs
		client := influxdb2.NewClientWithOptions(url, token,
			influxdb2.DefaultOptions().
				SetUseGZip(true))
		defer client.Close()

		queryApi := client.QueryAPI(dbInfo.Database)

		result, err := queryApi.Query(context.Background(), panel.Content)
		if err != nil {
			return err
		}

		return withJSONArrayOutWriterFile(w, func(w *jsonutil.StreamEncoder) error {
			for result.Next() {
				values := result.Record().Values()
				err := w.EncodeRow(values)
				if err != nil {
					return err
				}
			}

			return result.Err()
		})
	})
}
