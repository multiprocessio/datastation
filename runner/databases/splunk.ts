import { DatabaseConnectorInfo, TimeSeriesRange } from '../../shared/state';
import { EvalHandlerResponse } from '../types';

export async function evalSplunk(
  query: string,
  range: TimeSeriesRange,
  host: string,
  port: number,
  connector: DatabaseConnectorInfo
): Promise<EvalHandlerResponse> {
  return { value: [] };
}
