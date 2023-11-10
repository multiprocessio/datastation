package runner

import (
	"time"
)

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
