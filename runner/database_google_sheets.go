package runner

import (
	"context"
	"io"
	_ "strings"

	_ "github.com/multiprocessio/go-json"

	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

func evalGoogleSheets(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, w io.Writer) error {
	ctx := context.Background()

	token, err := dbInfo.ApiKey.decrypt()
	if err != nil {
		return err
	}

	srv, err := sheets.NewService(ctx, option.WithScopes(sheets.SpreadsheetsReadonlyScope), option.WithAPIKey(token))
	if err != nil {
		return edsef("Unable to retrieve Sheets client: %v", err)
	}

	_, err = srv.Spreadsheets.Get(panel.Database.Table).Do()
	if err != nil {
		return edsef("Unable to retrieve data from sheet: %v", err)
	}

	return nil

	// TODO

	// sheets := rsp.Sheets

	// // Single sheet files get flattened into just an array, not a dict mapping sheet name to sheet contents
	// if len(sheets) == 1 {
	// 	var header []string
	// 	row := map[string]interface{}{}
	// 	return withJSONArrayOutWriterFile(w, func(w *jsonutil.StreamEncoder) error {
	// 		if len(sheets[0].Data) != 1 {
	// 			return edsef("Too few or too many data grids (%d), should not be possible.", len(sheets[0].Data))
	// 		}

	// 		for i, r := range sheets[0].Data[0].RowData {
	// 			// Is first row, fill out header.
	// 			// TODO: let user opt out of headers being required
	// 			if header == nil {
	// 				for i, cell := range r.Values {
	// 					// TODO: if not a real header this might be nil?
	// 					header = append(header, *cell.UserEnteredValue.StringValue)
	// 				}
	// 				continue
	// 			}

	// 			// Otherwise is data row.
	// 			for i, header := range header {
	// 				if i < len(r.Values) -1 {
	// 					row[header] = r.Values[i].UserEnteredValue.StringValue
	// 				} else {
	// 					// Need to reset the cell
	// 					row[header] = nil
	// 				}
	// 			}

	// 			// TODO: could be cells without a header
	// 		}

	// 		return nil
	// 	})
	// }

	// return withJSONOutWriter(w, "{", "}", func() error {
	// 	for i, sheet := range sheets {
	// 		if i == 0 {
	// 			_, err := w.Write([]byte(",\n"))
	// 			if err != nil {
	// 				return err
	// 			}
	// 		}

	// 		sheetNameKey := `"` + strings.ReplaceAll(sheet, `"`, `\\"`) + `":`
	// 		_, err := w.Write([]byte(sheetNameKey))
	// 		if err != nil {
	// 			return err
	// 		}

	// 		err = withJSONArrayOutWriter(w, func(w *jsonutil.StreamEncoder) error {
	// 			rows, err := in.GetRows(sheet)
	// 			if err != nil {
	// 				return err
	// 			}
	// 			return writeSheet(rows, w)
	// 		})
	// 		if err != nil {
	// 			return err
	// 		}
	// 	}

	// 	return nil
	// })
}
