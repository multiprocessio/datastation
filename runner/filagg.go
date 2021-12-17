package main

import (
	"strconv"
)

func getDependentPanel(page ProjectPage, panelId string) (*PanelInfo, error) {
	for _, panel := range page.Panels {
		if panel.Name == panelId {
			cp := panel
			return &cp, nil
		}
	}

	if i, err := strconv.Atoi(panelId); err == nil && i < len(page.Panels) {
		return &page.Panels[i], nil
	}

	return nil, makeErrInvalidDependentPanel(panelId)
}

func evalFilaggPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	panel, err := getDependentPanel(project, panel)
	if err != nil {
		return err
	}

	qt := ansiSqlQuote
	fg := panel.Filagg

	columns := "*"
	groupByClause := ""
	if fg.AggregateType != "none" {
		groupColumn = quote(fg.GroupBy, qt.identifier)

		groupExpression := quote(fg.GroupBy, qt.identifier)
		if interval, err := strconv.Atoi(fg.WindowInterval); err == nil {
			intervalSeconds = interval * 60
			groupExpression = `DATETIME(STRFTIME("%s", `+fg.GroupBy+`) - STRFTIME("%s", `+fg.GroupBy+`) % `+intervalSeconds+`, "unixepoch")`
			groupColumn = groupExpression + " " + fg.GroupBy
		}

		on := 1
		if fg.AggregateOn != "" {
			on = quote(fg.AggregateOn, qt.identifier)
		}
		columns = fmt.Sprintf("%s, %s(%s) AS %s",
			groupColumn,
			strings.ToUpper(fg.AggregateType),
			on,
			quote(fg.AggregateType, qt))

		groupByClause = "GROUP BY " + groupExpression
	}

	whereClause := ""
	if filter != "" {
		whereClause = "WHERE " + filter
	}

	if range.field {
		{ begin, end } = timestampsFromRange(range)
		// Converts to UTC
		quoted = (t: string | Date) =>
			quote(
				format(
					addMinutes(new Date(t), new Date().getTimezoneOffset()),
					"yyyy-MM-dd HH:mm:ss"
				),
				qt.string
			)
		timeFilter = `DATETIME(${quote(
      range.field,
      qt.identifier
    )}) > ${quoted(begin)} AND DATETIME(${quote(
      range.field,
      qt.identifier
    )}) < ${quoted(end)}`

		if filter {
			whereClause = `WHERE (${filter} AND ${timeFilter})`
		} else {
			whereClause = "WHERE " + timeFilter
		}
	}

	orderByClause = ""
	if sortOn {
		sortQuoted = quote(sortOn, qt.identifier)
		sortField = sortQuoted
		if (sortOn || "").startsWith("Aggregate: ") {
			sortField = `${fg.AggregateType.toUpperCase()}(${
        fg.AggregateOn ? quote(fg.AggregateOn, qt.identifier) : 1
      })`
		}

		orderByClause = `ORDER BY ${sortField} ${sortAsc ? "ASC" : "DESC"}`
	}
	return `SELECT ${columns} FROM DM_getPanel(${panelIndex}) ${whereClause} ${groupByClause} ${orderByClause} LIMIT ${limit}`

}
