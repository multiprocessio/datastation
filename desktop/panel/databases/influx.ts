import fetch from 'node-fetch';
import { sqlRangeQuery } from '../../../shared/sql';
import {
  DatabaseConnectorInfo,
  DatabasePanelInfo,
  TimeSeriesRange,
} from '../../../shared/state';
import { fullHttpURL, queryParameters } from '../../../shared/url';
import { EvalHandlerResponse } from '../types';

interface InfluxResponse {
  results: Array<{
    columns: Array<string>;
    values: Array<Array<any>>;
  }>;
}

export async function evalInflux(
  query: string,
  range: TimeSeriesRange,
  host: string,
  port: number,
  { database: { database, username, password_encrypt } }: DatabaseConnectorInfo,
  panel: DatabasePanelInfo
): Promise<EvalHandlerResponse> {
  const rangeQuery = sqlRangeQuery(query, range, 'influx');
  const url = fullHttpURL(host, port);
  const endpoint = `${url}/query?${queryParameters({
    db: database,
    query: rangeQuery,
    u: username,
    p: password_encrypt.value,
  })}`;

  const response = await fetch(endpoint, {
    method: 'POST',
  });

  const j = (await response.json()) as InfluxResponse;
  if (response.status !== 200) {
    throw j;
  }

  const rows: Array<Record<string, any>> = [];
  for (const results of j.results) {
    for (const row of results.values) {
      const r: Record<string, any> = {};
      for (let i = 0; i < results.columns.length; i++) {
        r[results.columns[i]] = row[i];
      }
    }
  }

  return { value: rows };
}
