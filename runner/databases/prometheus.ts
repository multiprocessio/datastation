import log from '@datastation/shared/log';
import { timestampsFromRange } from '@datastation/shared/sql';
import {
  DatabaseConnectorInfo,
  DatabasePanelInfo,
  TimeSeriesRange,
} from '@datastation/shared/state';
import fetch from 'node-fetch';
import { EvalHandlerResponse } from '../types';

export interface PrometheusRangeResponse {
  status: string;
  data: {
    result: Array<{ metric: any; values: Array<[number, any]> }>;
  };
}

export async function evalPrometheus(
  query: string,
  range: TimeSeriesRange,
  host: string,
  port: number,
  connector: DatabaseConnectorInfo,
  panel: DatabasePanelInfo
): Promise<EvalHandlerResponse> {
  const { begin, end } = timestampsFromRange(range);
  const endpoint = `${host}${
    port ? ':' + String(port) : ''
  }/api/v1/query_range?query=${query}&start=${begin.valueOf() / 1000}&end=${
    end.valueOf() / 1000
  }&step=${panel.database.step}`;

  log.info('Prometheus query: ' + endpoint);
  const headers: Record<string, string> = {};
  if (
    connector.database.username ||
    connector.database.password_encrypt.value
  ) {
    headers['Authorization'] =
      'Basic ' +
      new Buffer(
        connector.database.username +
          ':' +
          connector.database.password_encrypt.value
      ).toString('base64');
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers,
  });
  const body = (await response.json()) as PrometheusRangeResponse;
  if (body.status !== 'success') {
    throw body;
  }

  const flatResults = body.data.result
    .map((m) =>
      m.values.map((v) => ({ metric: m.metric, time: v[0], value: v[1] }))
    )
    .flat();
  return { value: flatResults };
}
