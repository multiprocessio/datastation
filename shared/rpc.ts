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
