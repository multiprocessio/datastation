import {
  addMinutes,
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
import { InvalidDependentPanelError } from './errors';
import { FilterAggregatePanelInfo, TimeSeriesRange } from './state';

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

export function buildSQLiteQuery(
  vp: FilterAggregatePanelInfo,
  idIndexMap: Array<string>
): string {
  const {
    panelSource,
    aggregateType,
    aggregateOn,
    groupBy,
    filter,
    sortOn,
    sortAsc,
    range,
    limit,
    windowInterval,
  } = vp.filagg;

  const panelIndex = idIndexMap.findIndex((id) => id === panelSource);
  if (panelIndex === -1) {
    throw new InvalidDependentPanelError(panelIndex);
  }

  let columns = '*';
  let groupByClause = '';
  if (aggregateType !== 'none') {
    let groupColumn = quote(groupBy, ANSI_SQL_QUOTE.identifier);

    let groupExpression = quote(groupBy, ANSI_SQL_QUOTE.identifier);
    if (windowInterval && +windowInterval) {
      const intervalSeconds = +windowInterval * 60;
      groupExpression = `DATETIME(STRFTIME('%s', ${groupBy}) - STRFTIME('%s', ${groupBy}) % ${intervalSeconds}, 'unixepoch')`;
      groupColumn = `${groupExpression} ${groupBy}`;
    }

    columns = `${groupColumn}, ${aggregateType.toUpperCase()}(${
      aggregateOn ? quote(aggregateOn, ANSI_SQL_QUOTE.identifier) : 1
    }) AS ${quote(aggregateType, ANSI_SQL_QUOTE.identifier)}`;

    groupByClause = `GROUP BY ${groupExpression}`;
  }
  let whereClause = filter ? 'WHERE ' + filter : '';
  if (range.field) {
    const { begin, end } = timestampsFromRange(range);
    // Converts to UTC
    const quoted = (t: string | Date) =>
      quote(
        format(
          addMinutes(new Date(t), new Date().getTimezoneOffset()),
          'yyyy-MM-dd HH:mm:ss'
        ),
        ANSI_SQL_QUOTE.string
      );
    const timeFilter = `DATETIME(${quote(
      range.field,
      ANSI_SQL_QUOTE.identifier
    )}) > ${quoted(begin)} AND DATETIME(${quote(
      range.field,
      ANSI_SQL_QUOTE.identifier
    )}) < ${quoted(end)}`;

    if (filter) {
      whereClause = `WHERE (${filter} AND ${timeFilter})`;
    } else {
      whereClause = 'WHERE ' + timeFilter;
    }
  }

  let orderByClause = '';
  if (sortOn) {
    const sortQuoted = quote(sortOn, ANSI_SQL_QUOTE.identifier);
    let sortField = sortQuoted;
    if ((sortOn || '').startsWith('Aggregate: ')) {
      sortField = `${aggregateType.toUpperCase()}(${
        aggregateOn ? quote(aggregateOn, ANSI_SQL_QUOTE.identifier) : 1
      })`;
    }

    orderByClause = `ORDER BY ${sortField} ${sortAsc ? 'ASC' : 'DESC'}`;
  }
  return `SELECT ${columns} FROM DM_getPanel(${panelIndex}) ${whereClause} ${groupByClause} ${orderByClause} LIMIT ${limit}`;
}
