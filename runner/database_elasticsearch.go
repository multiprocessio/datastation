package runner

import (
	"encoding/base64"
	"io"
	"net/url"

	"github.com/multiprocessio/go-json"
)

var iso8601Format = "2006-01-02T15:04:05"

type elasticsearchResponse struct {
	Hits struct {
		Hits []map[string]any `json:"hits"`
	} `json:"hits"`
	ScrollId string `json:"_scroll_id"`
}

func (ec EvalContext) evalElasticsearch(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w io.Writer) error {
	var customCaCerts []string
	for _, caCert := range ec.settings.CaCerts {
		customCaCerts = append(customCaCerts, caCert.File)
	}

	indexes := panel.DatabasePanelInfo.Database.Table

	tls, host, port, rest, err := getHTTPHostPort(dbInfo.Address)
	if err != nil {
		return err
	}

	password, err := ec.decrypt(&dbInfo.Password)
	if err != nil {
		return err
	}

	token, err := ec.decrypt(&dbInfo.ApiKey)
	if err != nil {
		return err
	}

	return ec.withRemoteConnection(server, host, port, func(proxyHost, proxyPort string) error {
		baseUrl := makeHTTPUrl(tls, proxyHost, proxyPort, rest)
		u := baseUrl + "/" + indexes + "/_search"

		q := panel.Content
		_range := panel.DatabasePanelInfo.Database.Range
		if _range.Field != "" {
			begin, end, allTime, err := timestampsFromRange(_range)

			if !allTime {
				if err != nil {
					return err
				}

				if q != "" {
					q = "(" + q + ") AND "
				}

				q += _range.Field + ":[" + begin.Format(iso8601Format) + " TO " + end.Format(iso8601Format) + "]"
			}
		}
		u += "?"
		if q != "" {
			u += "?q=" + url.QueryEscape(q)
		}
		u += "&size=10000"
		// Closes the scroll after 10s of *idling* not 10s of scrolling
		u += "&scroll=5s"
		Logln("Making Elasticsearch request: %s. With query: (%s)", u, q)

		var headers []HttpConnectorInfoHeader
		if password != "" {
			basic := base64.StdEncoding.EncodeToString([]byte(dbInfo.Username + ":" + password))
			headers = append(headers, HttpConnectorInfoHeader{
				Name:  "Authorization",
				Value: "Basic " + basic,
			})
		} else if token != "" {
			headers = append(headers, HttpConnectorInfoHeader{
				Name:  "Authorization",
				Value: "Bearer " + token,
			})
		}

		rsp, err := makeHTTPRequest(httpRequest{
			allowInsecure: panel.Database.Extra["allow_insecure"] == "true",
			url:           u,
			method:        "GET",
			headers:       headers,
			customCaCerts: customCaCerts,
		})
		if err != nil {
			return err
		}
		defer rsp.Body.Close()

		var r elasticsearchResponse
		dec := jsonNewDecoder(rsp.Body)
		err = dec.Decode(&r)
		if err != nil {
			return err
		}

		return withJSONArrayOutWriterFile(w, func(w *jsonutil.StreamEncoder) error {
			for _, hit := range r.Hits.Hits {
				err := w.EncodeRow(hit)
				if err != nil {
					return err
				}
			}

			scrollId := r.ScrollId
			for {
				rsp, err := makeHTTPRequest(httpRequest{
					allowInsecure: panel.Database.Extra["allow_insecure"] == "true",
					url:           baseUrl + "/_search/scroll?scroll=10s&scroll_id=" + scrollId,
					method:        "GET",
					headers:       headers,
					customCaCerts: customCaCerts,
				})
				if err != nil {
					return err
				}

				dec := jsonNewDecoder(rsp.Body)
				var r elasticsearchResponse
				err = dec.Decode(&r)
				if err != nil {
					return err
				}

				for _, hit := range r.Hits.Hits {
					err := w.EncodeRow(hit)
					if err != nil {
						return err
					}
				}
				rsp.Body.Close()

				if len(r.Hits.Hits) == 0 {
					break
				}
			}

			// Clear the scroll context
			_, err = makeHTTPRequest(httpRequest{
				allowInsecure: panel.Database.Extra["allow_insecure"] == "true",
				url:           baseUrl + "/_search/scroll?scroll_id=" + scrollId,
				method:        "DELETE",
				headers:       headers,
				customCaCerts: customCaCerts,
			})
			if err != nil {
				Logln("Error while clearing Elasticsearch scroll: %s", err)
			}

			return nil
		})
	})
}
