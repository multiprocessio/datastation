package runner

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/elastic/go-elasticsearch/v6"
)

var iso8601Format = "2006-01-02T15:04:05"

type elasticsearchResponse struct {
	Hits struct {
		Hits []map[string]interface{} `json:"hits"`
	} `json:"hits"`
}

func evalElasticsearch(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w io.Writer) error {
	indexes := strings.Split(panel.DatabasePanelInfo.Database.Table, ",")
	for i := range indexes {
		indexes[i] = strings.TrimSpace(indexes[i])
	}

	tls, host, port, rest, err := getHTTPHostPort(dbInfo.Address)
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
		url := makeHTTPUrl(tls, proxyHost, proxyPort, rest)
		cfg := elasticsearch.Config{
			Addresses: []string{url},
		}
		if password != "" {
			cfg.Username = dbInfo.Username
			cfg.Password = password
		} else if token != "" {
			// TODO: Are either of these supposed to base64 encoded?
			cfg.APIKey = token
			cfg.Header = http.Header(map[string][]string{
				"Authorization": {"Bearer " + token},
			})
		}

		es, err := elasticsearch.NewClient(cfg)
		if err != nil {
			return err
		}

		q := panel.Content
		_range := panel.DatabasePanelInfo.Database.Range
		if _range.Field != "" {
			begin, end, err := timestampsFromRange(_range)
			if err != nil {
				return err
			}

			if q != "" {
				q = "(" + q + ") AND "
			}

			q += _range.Field + ":[" + begin.Format(iso8601Format) + " TO " + end.Format(iso8601Format) + "]"
		}

		res, err := es.Search(
			es.Search.WithContext(context.Background()),
			es.Search.WithIndex(indexes...),
			es.Search.WithQuery(q))
		if err != nil {
			return err
		}
		defer res.Body.Close()

		if res.IsError() {
			rsp, _ := ioutil.ReadAll(res.Body)
			return edsef("Error %s: %s", res.Status(), rsp)
		}

		var r elasticsearchResponse
		if err := json.NewDecoder(res.Body).Decode(&r); err != nil {
			return err
		}

		return withJSONArrayOutWriterFile(w, func(w *JSONArrayWriter) error {
			for _, hit := range r.Hits.Hits {
				err := w.Write(hit)
				if err != nil {
					return err
				}
			}

			return nil
		})
	})
}
