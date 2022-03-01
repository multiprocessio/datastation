package runner

import (
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"strings"
)

type airtableResponse struct {
	Offset  string `json:"offset"`
	Records []struct {
		Fields map[string]interface{} `json:"fields"`
	} `json:"records"`
}

func evalAirtable(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, w io.Writer) error {
	token, err := dbInfo.ApiKey.decrypt()
	if err != nil {
		return edse(err)
	}

	app := strings.TrimSpace(panel.Database.Extra["airtable_app"])
	table := strings.TrimSpace(panel.Database.Table)

	v := url.Values{}

	view := strings.TrimSpace(panel.Database.Extra["airtable_view"])
	if view != "" {
		v.Add("view", view)
	}

	q := strings.TrimSpace(panel.Content)
	if q != "" {
		v.Add("filterByFormula", q)
	}

	baseUrl := fmt.Sprintf("https://api.airtable.com/v0/%s/%s?%s", app, table, v.Encode())

	var r airtableResponse
	return withJSONArrayOutWriterFile(w, func(w *JSONArrayWriter) error {
		offset := ""
		first := true
		for offset != "" || first {
			first = false

			offsetParam := ""
			if offset != "" {
				offsetParam = "&offset=" + url.QueryEscape(offsetParam)
			}
			rsp, err := makeHTTPRequest(httpRequest{
				url: baseUrl + offsetParam,
				headers: []HttpConnectorInfoHeader{
					{
						Name:  "Authorization",
						Value: "Bearer " + token,
					},
				},
			})
			if err != nil {
				return err
			}

			defer rsp.Body.Close()

			if rsp.StatusCode >= 400 {
				b, _ := io.ReadAll(rsp.Body)
				return edsef("Failed to query Airtable (status %s): %s", rsp.Status, b)
			}

			err = json.NewDecoder(rsp.Body).Decode(&r)
			if err != nil {
				return err
			}

			for _, record := range r.Records {
				err = w.Write(record.Fields)
				if err != nil {
					return edse(err)
				}
			}

			offset = r.Offset
			first = false
		}

		return nil
	})
}
