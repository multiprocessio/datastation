package runner

import (
	"context"
	"fmt"

	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

func writeGoogleSheet(sheet *sheets.ValueRange, w *ResultWriter) error {
	var header []string

	for _, rawRow := range sheet.Values {
		// Is first row, fill out header.
		if header == nil {
			for _, cell := range rawRow {
				header = append(header, fmt.Sprintf("%v", cell))
			}
			w.SetFields(header)
			continue
		}

		err := w.WriteAnyRecord(rawRow, false)
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

func (ec EvalContext) evalGoogleSheets(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, w *ResultWriter) error {
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

		return writeGoogleSheet(valueRange, w)
	}

	sheetNames := map[string]string{}
	for _, sheet := range sheets {
		err := w.SetNamespace(sheet.Properties.Title)
		if err != nil {
			return err
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

		err = writeGoogleSheet(valueRange, w)
		if err != nil {
			return err
		}
	}

	return nil
}
