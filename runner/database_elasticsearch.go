package runner

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/elastic/go-elasticsearch/v6"
)

type elasticsearchResponse struct {
	Hits struct{
		Hits []map[string]interface{} `json:"hits"`
	} `json:"hits"`
}

func evalElasticsearch(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w io.Writer) error {
	indexes := strings.Split(dbInfo.Database, ",")
	for i := range indexes {
		indexes[i] = strings.TrimWhitespace(indexes[i])
	}

	tls, host, port, rest, err := getHTTPHostPort(dbInfo.Address)
	if err != nil {
		return err
	}

	password,

	token, err := dbInfo.ApiKey.decrypt()
	if err != nil {
		return err
	}

	return withRemoteConnection(server, host, port, func(proxyHost, proxyPort string) error {
		url := makeHTTPUrl(tls, proxyHost, proxyPort, rest)
		es, err := elasticsearch.NewDefaultClient()
		if err != nil {
			return err
		}

		res, err = es.Search(
			es.Search.WithContext(context.Background()),
			es.Search.WithIndex(indexes...),
			es.Search.WithTrackTotalHits(true),
		)
		if err != nil {
			return err
		}
		defer res.Body.Close()

		if res.IsError() {
			var e map[string]interface{}
			if err := json.NewDecoder(res.Body).Decode(&e); err != nil {
				return err
			}

			e["status"] = res.Status()
			return e
		}

		var r elasticsearchResponse
		if err := json.NewDecoder(res.Body).Decode(&r); err != nil {
			return err
		}

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
