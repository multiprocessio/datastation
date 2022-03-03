package runner

import (
	"context"
	"io"
	"math"
	"time"

	"github.com/multiprocessio/go-json"

	"github.com/prometheus/client_golang/api"
	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
)

func evalPrometheus(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w io.Writer) error {
	begin, end, err := timestampsFromRange(panel.DatabasePanelInfo.Database.Range)
	if err != nil {
		return err
	}

	tls, host, port, rest, err := getHTTPHostPort(dbInfo.Address)
	if err != nil {
		return err
	}

	password, err := dbInfo.Password.decrypt()
	if err != nil {
		return err
	}

	apiKey, err := dbInfo.ApiKey.decrypt()
	if err != nil {
		return err
	}

	return withRemoteConnection(server, host, port, func(proxyHost, proxyPort string) error {
		step := time.Second * time.Duration(math.Floor(panel.DatabasePanelInfo.Database.Step))
		if step <= 0*time.Second {
			// Default to 15 minutes
			step = 15 * time.Minute
		}
		if step <= 60*time.Second {
			// Don't allow less than 1 minute.
			step = time.Second
		}

		url := makeHTTPUrl(tls, proxyHost, proxyPort, rest)
		cfg := api.Config{Address: url}
		if password != "" {
			cfg.RoundTripper = config.NewBasicAuthRoundTripper(
				dbInfo.Username, config.Secret(password), "", api.DefaultRoundTripper)
		} else if apiKey != "" {
			cfg.RoundTripper = config.NewAuthorizationCredentialsRoundTripper(
				"Bearer", config.Secret(apiKey), api.DefaultRoundTripper)
		}

		client, err := api.NewClient(cfg)
		if err != nil {
			return err
		}

		v1api := v1.NewAPI(client)
		r := v1.Range{
			Start: begin,
			End:   end,
			Step:  step,
		}
		result, _, err := v1api.QueryRange(context.Background(), panel.Content, r)
		if err != nil {
			return err
		}

		m := result.(model.Matrix)
		return withJSONArrayOutWriterFile(w, func(w *jsonutil.StreamEncoder) error {
			for _, sample := range m {
				for _, row := range sample.Values {
					err := w.EncodeRow(map[string]interface{}{
						"metric": sample.Metric,
						"value":  row.Value,
						"time":   row.Timestamp,
					})
					if err != nil {
						return err
					}
				}
			}

			return nil
		})
	})
}
