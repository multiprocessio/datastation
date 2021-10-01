import { PrometheusDriver } from 'prometheus-query';
import { timestampsFromRange } from '../../../shared/sql';
import {
  DatabaseConnectorInfo,
  DatabasePanelInfo,
  TimeSeriesRange,
} from '../../../shared/state';
import { EvalHandlerResponse } from '../types';

export async function evalPrometheus(
  query: string,
  range: TimeSeriesRange,
  host: string,
  port: number,
  connector: DatabaseConnectorInfo,
  panel: DatabasePanelInfo
): Promise<EvalHandlerResponse> {
  const prom = new PrometheusDriver({
    endpoint: host + ':' + port,
  });

  const { begin, end } = timestampsFromRange(range);
  const { result: series } = await prom.rangeQuery(
    query,
    begin,
    end,
    panel.database.step
  );
  return { value: series.map((s) => s.value) };
}
