package runner

import (
	"encoding/base64"
	"context"
	"io"
)

type influxSeries struct {
	Values  `json:"values"`
}

type influxResult struct {
	Series []influxSeries `json:"series"`
}

type influxResponse struct {
	Results []influxResult `json:"results"`
}

// InfluxQL is supported in 1 and 2 but requires special setup in 2.
// See https://docs.influxdata.com/influxdb/v2.1/query-data/influxql/#verify-buckets-have-a-mapping
func evalInfluxQL(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w io.Writer) error {
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
		url := makeHTTPUrl(tls, proxyHost, proxyPort, "")
		url += "?q=" + panel.Content + "&db=" + dbInfo.Database

		var headers []HttpConnectorInfoHeader
		if password != "" {
			headers = append(headers, HttpConnectorInfoHeader{
				Name: "Authorization",
				Value: "Basic " + base64.StdEncoding.EncodeString([]byte(username + ":" + password)),
			})
		} else if token != "" {
			headers = append(headers, HttpConnectorInfoHeader{
				Name: "Authorization",
				Value: "Token " + base64.StdEncoding.EncodeString([]byte(token)),
			})
		}

		rsp, err := makeHTTPRequest(httpRequest{
			url: url,
			method: "GET",
			headers: headers,
		})

		var r influxResults

		return withJSONArrayOutWriterFile(w, func(w *JSONArrayWriter) error {
			for result.Next() {
				err := w.Write(result.Record().Values())
				if err != nil {
					return err
				}
			}

			return result.Err()
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

		queryApi := client.QueryAPI(dbInfo.Database)

		return withJSONArrayOutWriterFile(w, func(w *JSONArrayWriter) error {
			for result.Next() {
				err := w.Write(result.Record().Values())
				if err != nil {
					return err
				}
			}

			return result.Err()
		})
	})
}
