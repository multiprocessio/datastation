import { Shape } from 'shape';
import { FilterAggregatePanelInfo, SQLPanelInfo } from './state';

export type FilterAggregateEvalBody = FilterAggregatePanelInfo & {
  indexIdMap: Array<string>;
  indexShapeMap: Array<Shape>;
};

export type SQLEvalBody = SQLPanelInfo & {
  indexShapeMap: Array<Shape>;
  indexIdMap: Array<string>;
};

export type EvalColumnsBody = {
  id: string;
  columns: Array<string>;
  panelSource: number;
};

export const ENDPOINTS = {
  KILL_PROCESS: 'killProcess',
  EVAL_PROGRAM: 'evalProgram',

  STORE_LITERAL: 'storeLiteral',
  FETCH_RESULTS: 'fetchResults',
  EVAL_COLUMNS: 'evalColumns',

  EVAL_FILTER_AGGREGATE: 'evalFilterAggregate',

  EVAL_TIME_SERIES: 'evalTimeSeries',
};
