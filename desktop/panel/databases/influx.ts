import Influx from 'influx';
import { sqlRangeQuery } from '../../../shared/sql';
import {
  DatabaseConnectorInfo,
  DatabasePanelInfo,
  TimeSeriesRange,
} from '../../../shared/state';
import { EvalHandlerResponse } from '../types';

export async function evalInflux(
  query: string,
  range: TimeSeriesRange,
  host: string,
  port: number,
  { database: { database, username, password_encrypt } }: DatabaseConnectorInfo,
  panel: DatabasePanelInfo
): Promise<EvalHandlerResponse> {
  const influx = new Influx.InfluxDB({
    host,
    port,
    database,
    username: username || undefined,
    password: password_encrypt.value || undefined,
  });

  query = sqlRangeQuery(query, range, 'influx');
  const res = await influx.query(query);
  return {
    value: res
      .groups()
      .map((g) => g.rows)
      .flat(),
  };
}
