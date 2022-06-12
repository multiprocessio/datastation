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

func (ec EvalContext) evalPrometheus(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w *ResultWriter) error {
	begin, end, allTime, err := timestampsFromRange(panel.DatabasePanelInfo.Database.Range)
	if err != nil {
		return err
	}

	tls, host, port, rest, err := getHTTPHostPort(dbInfo.Address)
	if err != nil {
		return err
	}

	password, err := ec.decrypt(&dbInfo.Password)
	if err != nil {
		return err
	}

	apiKey, err := ec.decrypt(&dbInfo.ApiKey)
	if err != nil {
		return err
	}

	return ec.withRemoteConnection(server, host, port, func(proxyHost, proxyPort string) error {
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
			Step: step,
		}
		// TODO: This may not actually work to not set Start and End if alltime
		if !allTime {
			r.Start = begin
			r.End = end
		}
		result, _, err := v1api.QueryRange(context.Background(), panel.Content, r)
		if err != nil {
			return err
		}

		row := map[string]any{}
		m := result.(model.Matrix)
		for _, sample := range m {
			for _, rawRow := range sample.Values {
				row["metric"] = sample.Metric
				row["value"] = rawRow.Value
				row["time"] = rawRow.Timestamp
				err := w.WriteRow(row)
				if err != nil {
					return err
				}
			}
		}

		return nil
	})
}
