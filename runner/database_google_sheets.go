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

type Vector[T any] struct {
	s []T
	index int
}

func (v *Vector[T]) Push(el T) {
	defer func () { v.index++ } ()
	if v.index < cap(v.s) {
		v.s[v.index] = el
		return
	}

	v.s = append(v.s, el)
}

func (v *Vector[T]) Reset() {
	v.index = 0
}

func (v *Vector[T]) Slice() []T {
	return v.s
}

func writeGoogleSheet(sheet *sheets.Sheet, w *jsonutil.StreamEncoder) error {
	var header []string
	if len(sheet.Data) != 1 {
		fmt.Printf("%#v\n", sheet)
		debugObject(sheet.Properties)
		return makeErrUser(fmt.Sprintf("Too few or too many data grids (%d), should not be possible.", len(sheet.Data)))
	}

	var cells Vector[any]
	var row map[string]any

	for _, r := range sheet.Data[0].RowData {
		// Is first row, fill out header.
		if header == nil {
			for _, cell := range r.Values {
				if cell.UserEnteredValue.StringValue == nil {
					header = append(header, "")
					continue
				}
				
				header = append(header, *cell.UserEnteredValue.StringValue)
			}
			continue
		}

		cells.Reset()
		for _, v := range r.Values {
			cells.Push(v.UserEnteredValue.StringValue)
		}
		recordToMap(row, &header, cells.Slice())
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

	// Single sheet files get flattened into just an array, not a dict mapping sheet name to sheet contents
	if len(sheets) == 1 {
		rows := sheets[0].Properties.GridProperties.RowCount
		columns := sheets[0].Properties.GridProperties.ColumnCount

		// TODO: make request based on these ranges
		
		return withJSONArrayOutWriterFile(w, func(w *jsonutil.StreamEncoder) error {
			return writeGoogleSheet(sheets[0], w)
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
				return writeGoogleSheet(sheet, w)
			})
			if err != nil {
				return err
			}
		}

		return nil
	})
}
