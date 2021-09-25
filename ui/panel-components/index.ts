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
import { timeseriesPanel } from './TimeSeriesPanel';
import { PanelUIDetails } from './types';

export const PANEL_UI_DETAILS: { [Property in PanelInfoType]: PanelUIDetails } =
  {
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
    panels: (() => {
      const panels: Array<PanelInfoType> = ['http', 'file', 'literal'];

      // Weird way to make sure TypeScript type checks these strings.
      if (MODE !== 'browser') {
        panels.unshift('timeseries');
        panels.unshift('sql');
      }

      return panels;
    })(),
  },
  {
    label: 'Operate',
    panels: ['program', 'filagg'],
  },
  {
    label: 'Display',
    panels: ['graph', 'table'],
  },
];
