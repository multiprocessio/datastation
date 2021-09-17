import { Shape } from 'shape';
import {
  FilterAggregatePanelInfo,
  Proxy,
  SQLConnectorInfo,
  SQLPanelInfo,
} from './state';

export type FilterAggregateEvalBody = FilterAggregatePanelInfo & {
  indexIdMap: Array<string>;
  indexShapeMap: Array<Shape>;
};

export type SQLEvalBody = Proxy<
  SQLPanelInfo & { indexShapeMap: Array<Shape>; indexIdMap: Array<string> },
  SQLConnectorInfo
>;
