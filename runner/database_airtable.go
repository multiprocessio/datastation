package runner

import (
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"strings"

	"github.com/multiprocessio/go-json"
)

type airtableResponse struct {
	Offset  string `json:"offset"`
	Records []struct {
		Fields map[string]any `json:"fields"`
	} `json:"records"`
}

func (ec EvalContext) evalAirtable(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, w *ResultWriter) error {
	token, err := ec.decrypt(&dbInfo.ApiKey)
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
	offset := ""
	for {
		offsetParam := ""
		if offset != "" {
			offsetParam = "&offset=" + url.QueryEscape(offset)
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
			return makeErrUser(string(b))
		}

		err = json.NewDecoder(rsp.Body).Decode(&r)
		if err != nil {
			return err
		}

		for _, record := range r.Records {
			err = w.WriteRow(record.Fields)
			if err != nil {
				return edse(err)
			}
		}

		if offset == r.Offset || r.Offset == "" {
			break
		}

		offset = r.Offset
	}

	return nil
}
