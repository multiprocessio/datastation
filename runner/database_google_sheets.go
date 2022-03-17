package runner

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/multiprocessio/go-json"

	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

func writeGoogleSheet(sheet *sheets.Sheet, w *jsonutil.StreamEncoder, row *map[string]any) error {
	var header []string
	if len(sheet.Data) != 1 {
		fmt.Printf("%#v\n", sheet)
		return edsef("Too few or too many data grids (%d), should not be possible.", len(sheet.Data))
	}

	for _, r := range sheet.Data[0].RowData {
		// Is first row, fill out header.
		// TODO: let user opt out of headers being required
		if header == nil {
			for _, cell := range r.Values {
				// TODO: if not a real header this might be nil?
				header = append(header, *cell.UserEnteredValue.StringValue)
			}
			continue
		}

		// Otherwise is data row.
		for i, header := range header {
			if i < len(r.Values)-1 {
				(*row)[header] = r.Values[i].UserEnteredValue.StringValue
			} else {
				// Need to reset the cell
				(*row)[header] = nil
			}
		}

		// TODO: could be cells without a header
	}

	return nil
}

func (ec EvalContext) evalGoogleSheets(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, w io.Writer) error {
	ctx := context.Background()

	token, err := ec.decrypt(&dbInfo.ApiKey)
	if err != nil {
		return err
	}

	srv, err := sheets.NewService(ctx, option.WithScopes(sheets.SpreadsheetsReadonlyScope), option.WithCredentialsJSON([]byte(token)))
	if err != nil {
		return edsef("Unable to retrieve Sheets client: %v", err)
	}

	rsp, err := srv.Spreadsheets.Get(panel.Database.Table).Do()
	if err != nil {
		return makeErrUser(err.Error())
	}

	sheets := rsp.Sheets

	sharedRow := map[string]any{}
	// Single sheet files get flattened into just an array, not a dict mapping sheet name to sheet contents
	if len(sheets) == 1 {
		return withJSONArrayOutWriterFile(w, func(w *jsonutil.StreamEncoder) error {
			return writeGoogleSheet(sheets[0], w, &sharedRow)
		})
	}

	sheetNames := map[string]string{}
	return withJSONOutWriter(w, "{", "}", func() error {
		for i, sheet := range sheets {
			if i > 0 {
				_, err := w.Write([]byte(",\n"))
				if err != nil {
					return err
				}
			}

			name := sheet.Properties.Title
			nth := 0
			for {
				_, exists := sheetNames[name]
				if !exists {
					break
				}

				nth++
				name = fmt.Sprintf("%s%d", sheet.Properties.Title, nth)
			}
			sheetNameKey := `"` + strings.ReplaceAll(name, `"`, `\\"`) + `":`
			_, err := w.Write([]byte(sheetNameKey))
			if err != nil {
				return err
			}

			err = withJSONArrayOutWriter(w, func(w *jsonutil.StreamEncoder) error {
				return writeGoogleSheet(sheet, w, &sharedRow)
			})
			if err != nil {
				return err
			}
		}

		return nil
	})
}
