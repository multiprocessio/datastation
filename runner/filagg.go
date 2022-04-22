package runner

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

func getDependentPanel(page ProjectPage, panelId string) (*PanelInfo, int, error) {
	for i, panel := range page.Panels {
		if panel.Name == panelId || panel.Id == panelId {
			cp := panel
			return &cp, i, nil
		}
	}

	if i, err := strconv.Atoi(panelId); err == nil && i < len(page.Panels) {
		return &page.Panels[i], i, nil
	}

	return nil, 0, makeErrInvalidDependentPanel(panelId)
}

func startOfHour(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), 0, 0, 0, time.Local)
}

func startOfDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.Local)
}

func startOfWeek(t time.Time) time.Time {
	d := startOfDay(t)
	for d.Weekday() != time.Monday {
		d = d.AddDate(0, 0, -1)
	}
	return d
}

func startOfMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 0, 0, 0, 0, 0, time.Local)
}

func startOfQuarter(t time.Time) time.Time {
	m := startOfMonth(t)
	for m.Month()%3 != 0 {
		m = m.AddDate(0, -1, 0)
	}
	return m
}

func startOfYear(t time.Time) time.Time {
	return time.Date(t.Year(), 0, 0, 0, 0, 0, 0, time.Local)
}

func timestampsFromRange(r TimeSeriesRange) (time.Time, time.Time, bool, error) {
	if r.Type == "absolute" {
		return *r.BeginDate, *r.EndDate, false, nil
	}

	now := time.Now()
	if r.Type == "relative" {
		end := now
		switch *r.Relative {
		case "last-5-minutes":
			return now.Add(time.Minute * -5), end, false, nil
		case "last-15-minutes":
			return now.Add(time.Minute * -15), end, false, nil
		case "last-30-minutes":
			return now.Add(time.Minute * -30), end, false, nil
		case "last-hour":
			return now.Add(time.Minute * -60), end, false, nil
		case "last-3-hours":
			return now.Add(time.Hour * -3), end, false, nil
		case "last-6-hours":
			return now.Add(time.Hour * -6), end, false, nil
		case "last-12-hours":
			return now.Add(time.Hour * -12), end, false, nil
		case "last-day":
			return now.AddDate(0, 0, -1), end, false, nil
		case "last-3-days":
			return now.AddDate(0, 0, -3), end, false, nil
		case "last-week":
			return now.AddDate(0, 0, -7), end, false, nil
		case "last-2-weeks":
			return now.AddDate(0, 0, -14), end, false, nil
		case "last-month":
			return now.AddDate(0, -1, 0), end, false, nil
		case "last-2-months":
			return now.AddDate(0, -2, 0), end, false, nil
		case "last-3-months":
			return now.AddDate(0, -3, 0), end, false, nil
		case "last-6-months":
			return now.AddDate(0, -6, 0), end, false, nil
		case "last-year":
			return now.AddDate(-1, 0, 0), end, false, nil
		case "last-2-years":
			return now.AddDate(-2, 0, 0), end, false, nil
		case "all-time":
			return time.Time{}, time.Time{}, true, nil
		}
	} else {
		switch *r.Fixed {
		case "this-hour":
			return startOfHour(now), now, false, nil
		case "previous-hour":
			return startOfHour(now).Add(time.Hour * -1), startOfHour(now), false, nil
		case "today":
			return startOfDay(now), now, false, nil
		case "yesterday":
			return startOfDay(now).AddDate(0, 0, -1), startOfDay(now), false, nil
		case "week-to-date":
			return startOfWeek(now), now, false, nil
		case "previous-week":
			return startOfWeek(now).AddDate(0, 0, -7), startOfWeek(now), false, nil
		case "month-to-date":
			return startOfMonth(now), now, false, nil
		case "previous-month":
			return startOfMonth(now).AddDate(0, -1, 0), startOfMonth(now), false, nil
		case "quarter-to-date":
			return startOfQuarter(now), now, false, nil
		case "previous-quarter":
			return startOfQuarter(now).AddDate(0, -3, 0), startOfQuarter(now), false, nil
		case "year-to-date":
			return startOfYear(now), now, false, nil
		case "previous-year":
			return startOfYear(now).AddDate(-1, 0, 0), startOfYear(now), false, nil
		}
	}

	return time.Time{}, time.Time{}, false, edsef("Unsupported time range, %#v", r)
}

func quoteTime(t time.Time, qt quoteType) string {
	return quote(t.Format("2006-01-02 15:04:05"), qt.string)
}

func (ec EvalContext) evalFilaggPanel(project *ProjectState, pageIndex int, panel *PanelInfo) error {
	qt := ansiSQLQuote
	fg := panel.Filagg

	_, panelIndex, err := getDependentPanel(project.Pages[pageIndex], fg.GetPanelSource())
	if err != nil {
		return err
	}

	aggType := string(fg.AggregateType)

	columns := "*"
	groupByClause := ""
	if aggType != "none" {
		groupColumn := quote(fg.GroupBy, qt.identifier)

		groupExpression := quote(fg.GroupBy, qt.identifier)
		if interval, err := strconv.Atoi(fg.WindowInterval); err == nil && interval > 0 {
			intervalSeconds := fmt.Sprintf("%d", interval*60)
			groupExpression = `DATETIME(STRFTIME("%s", ` + fg.GroupBy + `) - STRFTIME("%s", ` + fg.GroupBy + `) % ` + intervalSeconds + `, "unixepoch")`
			groupColumn = groupExpression + " " + fg.GroupBy
		}

		on := "1"
		if fg.AggregateOn != "" {
			on = quote(fg.AggregateOn, qt.identifier)
		}
		columns = fmt.Sprintf("%s, %s(%s) AS %s",
			groupColumn,
			strings.ToUpper(aggType),
			on,
			quote(aggType, qt.identifier))

		groupByClause = "GROUP BY " + groupExpression
	}

	whereClause := ""
	if fg.Filter != "" {
		whereClause = "WHERE " + fg.Filter
	}

	if fg.Range.Field != "" {
		begin, end, allTime, err := timestampsFromRange(fg.Range)
		if err != nil {
			return err
		}

		if !allTime {
			timeFilter := fmt.Sprintf("DATETIME(%s) > %s AND DATETIME(%s) < %s",
				quote(fg.Range.Field, qt.identifier),
				quoteTime(begin, qt),
				quote(fg.Range.Field, qt.identifier),
				quoteTime(end, qt))

			if fg.Filter != "" {
				whereClause = fmt.Sprintf("WHERE (%s AND %s)", fg.Filter, timeFilter)
			} else {
				whereClause = "WHERE " + timeFilter
			}
		}
	}

	orderByClause := ""
	if fg.SortOn != "" {
		sortQuoteTime := quote(fg.SortOn, qt.identifier)
		sortField := sortQuoteTime

		if strings.HasPrefix(fg.SortOn, "Aggregate: ") {
			aggregateOn := "1"
			if fg.AggregateOn != "" {
				aggregateOn = quote(fg.AggregateOn, qt.identifier)
			}
			sortField = fmt.Sprintf("%s(%s)", strings.ToUpper(aggType), aggregateOn)
		}

		ascDesc := "DESC"
		if fg.SortAsc {
			ascDesc = "ASC"
		}
		orderByClause = fmt.Sprintf("ORDER BY %s %s", sortField, ascDesc)
	}

	query := fmt.Sprintf("SELECT %s FROM DM_getPanel(%d) %s %s %s LIMIT %d",
		columns,
		panelIndex,
		whereClause,
		groupByClause,
		orderByClause,
		fg.Limit)

	Logln("filagg query: %s", query)

	fakepanel := &PanelInfo{
		Content: query,
		Type:    ProgramPanel,
		Id:      panel.Id,
	}

	return ec.evalProgramSQLPanel(project, pageIndex, fakepanel)
}
