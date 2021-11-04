import fetch from 'node-fetch';
import {
  DatabaseConnectorInfo,
  DatabasePanelInfo,
  TimeSeriesRange,
} from '../../shared/state';
import { fullHttpURL, queryParameters } from '../../shared/url';
import { EvalHandlerResponse } from '../types';

interface InfluxResponse {
  results: Array<{
    series: Array<{
      columns: Array<string>;
      values: Array<any>;
      name: string;
    }>;
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
  const url = fullHttpURL(host, port);
  const params = queryParameters({
    db: database,
    q: query,
    u: username,
    p: password_encrypt.value,
  });
  const endpoint = `${url}/query?${params}`;

  const response = await fetch(endpoint, {
    method: 'POST',
  });
  const j = (await response.json()) as InfluxResponse;
  if (response.status !== 200) {
    throw j;
  }

  const rows: Array<Record<string, any>> = [];
  for (const results of j.results) {
    for (const series of results.series) {
      for (const row of series.values) {
        const r: Record<string, any> = {
          influx_series_name: series.name,
        };
        for (let i = 0; i < series.columns.length; i++) {
          r[series.columns[i]] = row[i];
        }

        rows.push(r);
      }
    }
  }

  return { value: rows };
}
