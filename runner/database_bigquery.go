package runner

import (
	"context"

	"cloud.google.com/go/bigquery"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

func (ec EvalContext) evalBigQuery(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, w *ResultWriter) error {
	ctx := context.Background()

	token, err := ec.decrypt(&dbInfo.ApiKey)
	if err != nil {
		return err
	}

	client, err := bigquery.NewClient(ctx, dbInfo.Database, option.WithCredentialsJSON([]byte(token)))
	if err != nil {
		return err
	}

	q := client.Query(panel.Content)
	it, err := q.Read(ctx)
	if err != nil {
		return err
	}

	var fields []string
	var values []bigquery.Value

	for {
		err := it.Next(&values)
		if err == iterator.Done {
			return nil
		}
		if err != nil {
			return err
		}

		if len(fields) == 0 {
			// it.Schema is only populated after the first call to it.Next()
			for _, field := range it.Schema {
				fields = append(fields, field.Name)
			}
			w.SetFields(fields)
		}

		// bigquery seems to return more values than fields
		values = values[:len(fields)]

		err = w.WriteBigQueryRecord(values, false)
		if err != nil {
			return err
		}

		// Zeroes out "values" while preserving its capacity
		values = values[:0]
	}
}
