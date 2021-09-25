import { MODE } from '../../shared/constants';
import { PanelInfoType, PanelResult } from '../../shared/state';
import { evalSQLPanel, SQLPanelDetails } from './SQLPanel';
import { evalFilePanel, FilePanelDetails } from './FilePanel';
import {
  evalFilterAggregatePanel,
  FilterAggregatePanelDetails,
} from './FilterAggregatePanel';
import { GraphPanel, GraphPanelDetails } from './GraphPanel';
import { evalHTTPPanel, HTTPPanelDetails } from './HTTPPanel';
import { evalLiteralPanel, LiteralPanelDetails } from './LiteralPanel';
import { evalProgramPanel, ProgramPanelDetails } from './ProgramPanel';
import { evalColumnPanel, TablePanel, TablePanelDetails } from './TablePanel';
import { makeDefaultPanelBody } from './DefaultPanelBody';
import { PanelDetailsProps, PanelBodyProps, } from './types';

export interface PanelUIDetails {
  icon: string;
  eval: () => Promise<PanelResult>;
  id: PanelInfoType;
  label: string;
  details: React.Component<PanelDetailsProps>;
  body: React.Component<PanelBodyProps> | null;
  alwaysOpen: boolean;
  previewable: boolean;
  factory: () => PanelInfo;
};

export const httpPanel: PanelUIDetails = {
  icon: 'http',
  eval: evalHTTPPanel,
  id: 'http',
  label: 'HTTP',
  details: HTTPPanelDetails,
  body: HTTPPanelBody,
  alwaysOpen: true,
  previewable: true,
  factory: () => new HTTPPanelInfo,
};

export const literalPanel: PanelUIDetails = {
  icon: 'format_quote',
  eval: evalLiteralPanel,
  id: 'literal',
  label: 'Literal',
  details: LiteralPanelDetails,
  body: LiteralPanelBody,
  alwaysOpen: false,
  previewable: true,
  factory: () => new LiteralPanelInfo,
};

export const programPanel: PanelUIDetails = {
  icon: 'code',
  eval: evalLiteralPanel,
  id: 'program',
  label: 'Code',
  details: ProgramPanelDetails,
  body: ProgramPanelBody,
  alwaysOpen: false,
  previewable: true,
  factory: () => new ProgramPanelInfo,
};

export const tablePanel: PanelUIDetails = {
  icon: 'table_chart',
  eval: evalTablePanel,
  id: 'table',
  label: 'Table',
  details: TablePanelDetails,
  body: TablePanel,
  alwaysOpen: true,
  previewable: false,
  factory: () => new TablePanelInfo,
};

export const graphPanel: PanelUIDetails = {
  icon: 'bar_chart',
  eval: evalGraphPanel,
  id: 'graph',
  label: 'Graph',
  details: GraphPanelDetails,
  body: GraphPanel,
  alwaysOpen: true,
  previewable: false,
  factory: () => new GraphPanelInfo,
};

export const sqlPanel: PanelUIDetails = {
  icon: 'table_rows',
  eval: evalSQLPanel,
  id: 'sql',
  label: 'SQL',
  details: SQLPanelDetails,
  body: SQLPanelBody,
  alwaysOpen: false,
  previewable: true,
  factory: () => new SQLPanelInfo,
};

export const filePanel: PanelUIDetails = {
  icon: 'description',
  eval: evalFilePanel,
  id: 'file',
  label: 'File',
  details: FilePanelDetails,
  body: null,
  alwaysOpen: false,
  previewable: true,
  factory: () => new FilePanelInfo,
};

export const filaggPanel: PanelUIDetails = {
  icon: 'search',
  eval: evalFilterAggregatePanel,
  id: 'filagg',
  label: 'Visual Transform',
  details: FilterAggregatePanelDetails,
  body: null,
  alwaysOpen: false,
  previewable: true,
  factory: () => new FilterAggregatePanelInfo,
};

export const timeseriesPanel: PanelUIDetails = {
  icon: 'calender_view_week',
  eval: evalTimeSeriesPanel,
  id: 'timeseries',
  label: 'Time Series',
  details: TimeSeriesPanelDetails,
  body: null,
  alwaysOpen: false,
  previewable: true,
  factory: () => new TimeSeriesPanelInfo,
};

export const PANEL_UI_DETAILS: Record<PanelInfoType, PanelUIDetails> = {
  table: tablePanel,
  http: httpPanel,
  graph: graphPanel,
  program: programPanel,
  literal: literalPanel,
  sql: sqlPanel,
  file: filePanel,
  filagg: filaggPanel,
  timeseries: timeseriesPanel,
};

export const PANEL_GROUPS: Array<{ label: string; panels: Array<PanelInfoType> }> = [
  {
    label: 'Import',
    panels: [...(MODE !== 'browser' ? ['sql', 'timeseries'] : []), 'http', 'file', 'literal'],
  },
  {
    label: 'Operate',
    panels: ['code', 'filagg'],
  },
  {
    label: 'Display',
    panels: ['graph', 'table'],
  },
];
