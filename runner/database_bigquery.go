package runner

import (
	"context"
	"io"

	"github.com/multiprocessio/go-json"

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
	for _, field := range it.Schema {
		fields = append(fields, field.Name)
	}
	w.SetFields(fields)
	var values []bigquery.Value
	var valuesAny []any

	for {
		err := it.Next(&values)
		if err == iterator.Done {
			return nil
		}
		if err != nil {
			return err
		}

		if len(valuesAny) != len(values) {
			valuesAny = make([]any, len(values))
		}

		for i := range values {
			valuesAny[i] = values[i]
		}

		err = w.WriteAnyRecord(valuesAny)
		if err != nil {
			return err
		}
	}
}
