package runner

import (
	"context"
	"fmt"
	"io"

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

	rsp, err := srv.Spreadsheets.Get(panel.Database.Table).Do()
	if err != nil {
		return edsef("Unable to retrieve data from sheet: %v", err)
	}

	fmt.Printf("%#v\n", rsp)
	return withJSONArrayOutWriterFile(w, func(w *JSONArrayWriter) error {
		return nil
	})
}
