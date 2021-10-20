import { MODE } from '../../shared/constants';
import { PanelInfo, PanelInfoType } from '../../shared/state';
import { databasePanel } from './DatabasePanel';
import { filePanel } from './FilePanel';
import { filaggPanel } from './FilterAggregatePanel';
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
  filagg: filaggPanel,
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
        panels.unshift('database');
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

export function resolveDependencies(panels: PanelInfo[], panel: PanelInfo): Array<string> {
  const dependencies = [];
  const stack: Array<string> = [panel.id];
  while (stack.length) {
    const top = stack.pop();
    const panel: PanelInfo = panels.find(p => p.id === top);
    dependencies.push(panel.id);
    const details = PANEL_UI_DETAILS[panel.type];
    stack.push(...details.panelDependencies(panel));
  }

  // TODO: check for circular dependencies?

  // Duplicates should be removed only from higher level dependencies
  // otherwise lower-level dependencies would fail.
  return [...new Set(dependencies.reverse())];
}
