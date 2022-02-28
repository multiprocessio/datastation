package runner

import (
	"io"

	"github.com/mehanizm/airtable"
)

func evalAirtable(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, w io.Writer) error {
	token, err := dbInfo.ApiKey.decrypt()
	if err != nil {
		return edse(err)
	}

	client := airtable.NewClient(token)
	table := client.GetTable(dbInfo.Username, panel.Database.Table)

	return withJSONArrayOutWriterFile(w, func(w *JSONArrayWriter) error {
		offset := ""
		first := true
		for offset != "" || first {
			results, err := table.GetRecords().
				WithFilterFormula(panel.Content).
				WithOffset(offset).
				Do()
			if err != nil {
				return edse(err)
			}

			for _, record := range results.Records {
				err = w.Write(record.Fields)
				if err != nil {
					return edse(err)
				}
			}

			offset = results.Offset
			first = false
		}

		return nil
	})
}
