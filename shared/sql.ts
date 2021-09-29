import {
  format,
  startOfHour,
  startOfMonth,
  startOfQuarter,
  startOfToday,
  startOfWeek,
  startOfYear,
  startOfYesterday,
  subDays,
  subHours,
  subMinutes,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
} from 'date-fns';
import { SQLConnectorType, TimeSeriesRange } from './state';

export function timestampsFromRange(range: TimeSeriesRange) {
  if (range.rangeType === 'absolute') {
    return { begin: range.begin_date, end: range.end_date };
  }

  const now = new Date();
  if (range.rangeType === 'relative') {
    const end = now;
    switch (range.relative) {
      case 'last-5-minutes':
        return { begin: subMinutes(now, 5), end };
      case 'last-15-minutes':
        return { begin: subMinutes(now, 15), end };
      case 'last-30-minutes':
        return { begin: subMinutes(now, 30), end };
      case 'last-hour':
        return { begin: subMinutes(now, 60), end };
      case 'last-3-hours':
        return { begin: subHours(now, 3), end };
      case 'last-6-hours':
        return { begin: subHours(now, 6), end };
      case 'last-12-hours':
        return { begin: subHours(now, 12), end };
      case 'last-day':
        return { begin: subDays(now, 1), end };
      case 'last-3-days':
        return { begin: subDays(now, 3), end };
      case 'last-week':
        return { begin: subDays(now, 7), end };
      case 'last-2-weeks':
        return { begin: subDays(now, 14), end };
      case 'last-month':
        return { begin: subMonths(now, 1), end };
      case 'last-2-months':
        return { begin: subMonths(now, 2), end };
      case 'last-3-months':
        return { begin: subMonths(end, 3), end };
      case 'last-6-months':
        return { begin: subMonths(end, 6), end };
      case 'last-year':
        return { begin: subYears(end, 1), end };
      case 'last-2-years':
        return { begin: subYears(end, 2), end };
      case 'all-time':
        return { begin: new Date(0), end };
    }
  } else {
    switch (range.fixed) {
      case 'this-hour':
        return { begin: subHours(startOfHour(now), 1), end: startOfHour(now) };
      case 'previous-hour':
        return {
          begin: subHours(startOfHour(now), 2),
          end: subHours(startOfHour(now), 1),
        };
      case 'today':
        return { begin: startOfToday(), end: now };
      case 'yesterday':
        return { begin: startOfYesterday(), end: startOfToday() };
      case 'week-to-date':
        return {
          begin: startOfWeek(now),
          end: now,
        };
      case 'previous-week':
        return { begin: subWeeks(startOfWeek(now), 1), end: startOfWeek(now) };
      case 'month-to-date':
        return { begin: startOfMonth(now), end: now };
      case 'previous-month':
        return {
          begin: subMonths(startOfMonth(now), 1),
          end: startOfMonth(now),
        };
      case 'quarter-to-date':
        return { begin: startOfQuarter(now), end: now };
      case 'previous-quarter':
        return {
          begin: subQuarters(startOfQuarter(now), 1),
          end: startOfQuarter(now),
        };
      case 'year-to-date':
        return { begin: startOfYear(now), end: now };
      case 'previous-year':
        return { begin: subYears(startOfYear(now), 1), end: startOfYear(now) };
    }
  }

  throw new Error('Unsupported time range: ' + JSON.stringify(range));
}

export function quote(
  fieldOrValue: any,
  quoteString: string,
  slashEscape = false
) {
  const escape = slashEscape ? '\\' : quoteString;
  return `${quoteString}${String(fieldOrValue).replaceAll(
    quoteString,
    escape + quoteString
  )}${quoteString}`;
}

export interface QuoteType {
  string: string;
  identifier: string;
}

export const ANSI_SQL_QUOTE = {
  string: "'",
  identifier: '"',
};

export const MYSQL_QUOTE = {
  string: '"',
  identifier: '`',
};

export function sqlRangeQuery(
  query: string,
  range: TimeSeriesRange | null,
  type: SQLConnectorType
) {
  if (!range || !range.field) {
    return query;
  }

  // TODO: what happens if a user overrides these defaults? MySQL can run in ANSI SQL mode.
  const quoteStyle = type === 'mysql' ? MYSQL_QUOTE : ANSI_SQL_QUOTE;

  const { begin, end } = timestampsFromRange(range);

  function formatTimestamp(t: Date | string) {
    const quotedTime = quote(
      format(new Date(t), 'yyyy-MM-dd HH:mm:ss'),
      quoteStyle.string
    );
    if (type === 'clickhouse') {
      return `parseDateTimeBestEffort(${quotedTime})`;
    }

    // Timestamp functions/formats differ by engine as soon as we bring in time zones. We're not doing that yet.
    return 'TIMESTAMP ' + quotedTime;
  }

  // This is not going to work for systems like Cassandra that don't support subqueries.
  return `SELECT * FROM (${query}) WHERE ${quote(
    range.field,
    quoteStyle.identifier
  )} > ${formatTimestamp(begin)} AND ${quote(
    range.field,
    quoteStyle.identifier
  )} < ${formatTimestamp(end)}`;
}
