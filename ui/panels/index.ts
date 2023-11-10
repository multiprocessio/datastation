import { MODE } from '../../shared/constants';
import { PanelInfoType } from '../../shared/state';
import { databasePanel } from './DatabasePanel';
import { filePanel } from './FilePanel';
import { graphPanel } from './GraphPanel';
import { httpPanel } from './HTTPPanel';
import { literalPanel } from './LiteralPanel';
import { programPanel } from './ProgramPanel';
import { tablePanel } from './TablePanel';
import { PanelUIDetails } from './types';

export const PANEL_UI_DETAILS: {
  [Property in PanelInfoType]: PanelUIDetails<any>;
} = {
  table: tablePanel,
  http: httpPanel,
  graph: graphPanel,
  program: programPanel,
  literal: literalPanel,
  database: databasePanel,
  file: filePanel,
};

export const PANEL_GROUPS: Array<{
  label: string;
  panels: Array<PanelInfoType>;
}> = [
  {
    label: 'Import from',
    panels: (() => {
      const panels: Array<PanelInfoType> = ['http', 'file', 'literal'];

      // Weird way to make sure TypeScript type checks these strings.
      if (MODE !== 'browser') {
        panels.unshift('database');
      }

      return panels;
    })(),
  },
  {
    label: 'Operate with',
    panels: ['program'],
  },
  {
    label: 'Visualize with',
    panels: ['graph', 'table'],
  },
];
