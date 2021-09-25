import { MODE } from '../../shared/constants';
import { PanelInfoType } from '../../shared/state';
import { filePanel } from './FilePanel';
import { filaggPanel } from './FilterAggregatePanel';
import { graphPanel } from './GraphPanel';
import { httpPanel } from './HTTPPanel';
import { literalPanel } from './LiteralPanel';
import { programPanel } from './ProgramPanel';
import { sqlPanel } from './SQLPanel';
import { tablePanel } from './TablePanel';

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

export const PANEL_GROUPS: Array<{
  label: string;
  panels: Array<PanelInfoType>;
}> = [
  {
    label: 'Import',
    panels: [
      ...(MODE !== 'browser' ? ['sql', 'timeseries'] : []),
      'http',
      'file',
      'literal',
    ],
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
