package runner

import (
	"encoding/base64"
	"net/url"
)

var iso8601Format = "2006-01-02T15:04:05"

type elasticsearchResponse struct {
	Hits struct {
		Hits []map[string]any `json:"hits"`
	} `json:"hits"`
	ScrollId string `json:"_scroll_id"`
	Status   int    `json:"status"`
	Error    struct {
		Reason    string           `json:"reason"`
		Type      string           `json:"type"`
		RootCause []map[string]any `json:"root_cause"`
	} `json:"error"`
}

func makeScrollRequest(baseUrl, scrollId string, req httpRequest) (*elasticsearchResponse, error) {
	rsp, err := makeHTTPRequest(req)
	if err != nil {
		return nil, err
	}
	defer rsp.Body.Close()

	var r elasticsearchResponse
	defer func() {
		// No cleanup this time if the scrollId remains the same
		if len(r.Hits.Hits) > 0 && r.ScrollId == scrollId {
			return
		}

		bodyBytes, err := jsonMarshal(map[string]any{
			"scroll_id": scrollId,
		})
		if err != nil {
			Logln("Couldn't marshal clear context JSON body: %s", err)
			return
		}

		// Clear the scroll context under any condition
		_, err = makeHTTPRequest(httpRequest{
			allowInsecure: req.allowInsecure,
			url:           baseUrl + "/_search/scroll",
			method:        "DELETE",
			headers:       req.headers,
			customCaCerts: req.customCaCerts,
			body:          bodyBytes,
			sendBody:      true,
		})
		if err != nil {
			Logln("Error while clearing Elasticsearch scroll: %s", err)
			return
		}

		Logln("Cleared scroll id")
	}()

	dec := jsonNewDecoder(rsp.Body)
	err = dec.Decode(&r)
	if err != nil {
		return nil, err
	}

	if r.Status >= 400 {
		return nil, makeErrUser(r.Error.Reason)
	}

	return &r, nil
}

func (ec EvalContext) evalElasticsearch(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w *ResultWriter) error {
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
			u += "q=" + url.QueryEscape(q)
		}
		u += "&size=10000"
		// Closes the scroll after 1m of *idling* not 1m of scrolling
		u += "&scroll=1m"
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

		// Set up the scroll context
		rsp, err := makeHTTPRequest(httpRequest{
			allowInsecure: panel.Database.Extra["allow_insecure"] == "true",
			url:           u,
			method:        "POST",
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

		scrollId := r.ScrollId

		for _, hit := range r.Hits.Hits {
			err := w.WriteRow(hit)
			if err != nil {
				return err
			}
		}

		for {
			bodyBytes, err := jsonMarshal(map[string]any{
				"scroll":    "1m",
				"scroll_id": scrollId,
			})
			if err != nil {
				return err
			}

			Logln("Making new request with scroll id")
			r, err := makeScrollRequest(baseUrl, scrollId, httpRequest{
				allowInsecure: panel.Database.Extra["allow_insecure"] == "true",
				url:           baseUrl + "/_search/scroll",
				method:        "POST",
				headers: append(headers, HttpConnectorInfoHeader{
					Name:  "content-type",
					Value: "application/json",
				}),
				customCaCerts: customCaCerts,
				body:          bodyBytes,
				sendBody:      true,
			})
			if err != nil {
				Logln("Error: %#v", err)
				return err
			}

			scrollId = r.ScrollId

			for _, hit := range r.Hits.Hits {
				err := w.WriteRow(hit)
				if err != nil {
					return err
				}
			}

			if len(r.Hits.Hits) == 0 {
				return nil
			}
		}
	})
}
