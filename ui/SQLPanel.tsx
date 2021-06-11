import * as React from 'react';

import {
  ConnectorInfo,
  SQLConnectorInfo,
  SQLPanelInfo,
  Array,
} from './../shared/state';

import { asyncRPC } from './asyncRPC';
import { PanelResult, ProjectContext } from './ProjectStore';
import { Select } from './component-library/Select';

export async function evalSQLPanel(
  panel: SQLPanelInfo,
  panelResults: Array<PanelResult>
) {
  if (!panel.content.trim().toLowerCase().startsWith('select ')) {
    throw new Error('SQL must be read-only SELECT');
  }

  // TODO: make panel substitution based on an actual parser since
  // regex will match instances of `' foo bar DM_getPanel(21)[sdklf] '`
  // among other bad things...
  const matcher = /DM_getPanel\(([0-9]+)\)\[(.*)\]/;
  let content = panel.content;
  try {
    content = content.replace(matcher, function (match, panelIndex, column) {
      return (
        '(' +
        (panelResults[panelIndex]?.value || [])
          .map((row) => row[column])
          .join(',') +
        ')'
      );
    });
  } catch (e) {
    console.error(e);
    throw new Error('Malformed substitution in SQL');
  }

  if (panel.sql.sql.type === 'postgres') {
    return await asyncRPC<SQLConnectorInfo, string, Array<object>>(
      'evalSQL',
      content,
      panel.sql
    );
  }

  throw new Error(`Unknown SQL type: '${panel.sql.type}'`);
}

export function SQLPanelDetails({
  panel,
  updatePanel,
}: {
  panel: SQLPanelInfo;
  updatePanel: (d: SQLPanelInfo) => void;
}) {
  const { connectors } = React.useContext(ProjectContext);

  return (
    <React.Fragment>
      <div>
        <Select
          label="Vendor"
          className="block"
          value={panel.sql.type}
          onChange={(value: string) => {
            switch (value) {
              case 'postgres':
                panel.sql.sql.type = 'postgres';
                break;
              default:
                throw new Error(`Unknown SQL type: ${value}`);
            }
            updatePanel(panel);
          }}
        >
          <option value="postgres">PostgreSQL</option>
        </Select>
        <Select
          label="Connector"
          className="block"
          value={panel.sql.type}
          onChange={(connectorIndex: string) => {
            panel.sql.sql = (
              connectors[+connectorIndex] as SQLConnectorInfo
            ).sql;
            updatePanel(panel);
          }}
        >
          {connectors
            .map((c: ConnectorInfo, index: number) => {
              if (c.type != 'sql') {
                return null;
              }

              return <option value={index}>c.name</option>;
            })
            .filter(Boolean)}
        </Select>
      </div>
    </React.Fragment>
  );
}
