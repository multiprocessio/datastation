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
	s     []T
	index int
}

func (v *Vector[T]) Push(el T) {
	defer func() { v.index++ }()
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

func writeGoogleSheet(sheet *sheets.ValueRange, w *jsonutil.StreamEncoder) error {
	var header []string

	row := map[string]any{}

	for _, rawRow := range sheet.Values {
		// Is first row, fill out header.
		if header == nil {
			for _, cell := range rawRow {
				header = append(header, fmt.Sprintf("%v", cell))
			}
			continue
		}

		recordToMap(row, &header, rawRow)

		err := w.EncodeRow(row)
		if err != nil {
			return err
		}
	}

	return nil
}

func fetchGoogleSheetValueRange(srv *sheets.Service, sheetId string, sInfo *sheets.Sheet) (*sheets.ValueRange, error) {
	rows := sInfo.Properties.GridProperties.RowCount
	columns := sInfo.Properties.GridProperties.ColumnCount
	title := sInfo.Properties.Title

	readRange := fmt.Sprintf("%s!A1:%s%d", title, indexToExcelColumn(int(columns)), rows+1)

	rsp, err := srv.Spreadsheets.Values.Get(sheetId, readRange).Do()
	if err != nil {
		return nil, makeErrUser(err.Error())
	}

	return rsp, nil
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
		valueRange, err := fetchGoogleSheetValueRange(srv, panel.Database.Table, sheets[0])
		if err != nil {
			return err
		}

		return withJSONArrayOutWriterFile(w, func(w *jsonutil.StreamEncoder) error {
			return writeGoogleSheet(valueRange, w)
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

			valueRange, err := fetchGoogleSheetValueRange(srv, panel.Database.Table, sheets[0])
			if err != nil {
				return err
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
			_, err = w.Write([]byte(sheetNameKey))
			if err != nil {
				return err
			}

			err = withJSONArrayOutWriter(w, func(w *jsonutil.StreamEncoder) error {
				return writeGoogleSheet(valueRange, w)
			})
			if err != nil {
				return err
			}
		}

		return nil
	})
}
