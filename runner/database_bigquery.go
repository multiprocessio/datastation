package runner

import (
	"context"
	"io"

	"cloud.google.com/go/bigquery"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

func evalBigQuery(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, server *ServerInfo, w io.Writer) error {
	ctx := context.Background()

	token, err := dbInfo.ApiKey.decrypt()
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

	return withJSONArrayOutWriterFile(w, func(w *JSONArrayWriter) error {
		for {
			var values []bigquery.Value
			err := it.Next(&values)
			if err == iterator.Done {
				return nil
			}
			if err != nil {
				return err
			}

			row := map[string]interface{}{}
			for i, field := range it.Schema {
				row[field.Name] = values[i]
			}

			err = w.Write(row)
			if err != nil {
				return err
			}
		}
	})
}
