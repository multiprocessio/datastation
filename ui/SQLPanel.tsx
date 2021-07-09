import * as React from 'react';

import {
  Proxy,
  ServerInfo,
  ConnectorInfo,
  SQLConnectorInfo,
  SQLConnectorInfoType,
  SQLPanelInfo,
  PanelResult,
} from '../shared/state';
import { DEBUG, MODE_FEATURES } from '../shared/constants';

import { asyncRPC } from './asyncRPC';
import { ProjectContext } from './ProjectStore';
import { ServerPicker } from './ServerPicker';
import { Select } from './component-library/Select';

export async function evalSQLPanel(
  panel: SQLPanelInfo,
  panelResults: Array<PanelResult>,
  connectors: Array<ConnectorInfo>,
  servers: Array<ServerInfo>
) {
  // TODO: make panel substitution based on an actual parser since
  // regex will match instances of `' foo bar DM_getPanel(21)[sdklf] '`
  // among other bad things...
  const matcher = /DM_getPanel\(([0-9]+)\)/g;
  let content = panel.content;
  try {
    let replacements: Array<number> = [];
    content = content.replace(matcher, function (match, panelIndex) {
      replacements.push(+panelIndex);
      return `t${replacements.length - 1}`;
    });

    const valueQuote = panel.sql.type === 'in-memory' ? "'" : '"';
    const columnQuote = panel.sql.type === 'mysql' ? '`' : '"';

    let ctePrefix = '';
    replacements.forEach((panelIndex: number, tableIndex: number) => {
      const results = panelResults[panelIndex];
      if (!results || results.exception || results.value.length === 0) {
        // TODO: figure out how to query empty panels. (How to resolve column names for SELECT?)
        throw new Error(`Cannot query empty results in panel ${panelIndex}`);
      }
      const columns = Object.keys(results.value[0]);
      const valuesAsSQLStrings = results.value.map(
        (row: { [k: string]: any }) => {
          return columns.map((column: string) => {
            const cell = row[column];
            if (typeof cell === 'number' || typeof cell === 'boolean') {
              return String(cell);
            }

            if (cell === undefined || cell === null) {
              return 'null';
            }

            // Default to stringifying.
            let stringified = JSON.stringify(cell);
            if (!stringified) {
              return 'null';
            }

            // Replace double quoted strings with correct quote type
            if (stringified[0] === '"') {
              stringified = stringified.substring(1, stringified.length - 1);
            }

            // Make sure to escape embedded quotes
            return (
              valueQuote +
              stringified.replaceAll(valueQuote, valueQuote + valueQuote) +
              valueQuote
            );
          });
        }
      );
      const quotedColumns = columns
        .map(
          (c: string) =>
            columnQuote +
            c.replaceAll(columnQuote, columnQuote + columnQuote) +
            columnQuote
        )
        .join(', ');
      const values = valuesAsSQLStrings
        .map((v: Array<string>) => `(${v.join(', ')})`)
        .join(', ');
      let prefix = ', ';
      if (tableIndex === 0) {
        prefix = 'WITH ';
      }
      ctePrefix = `${ctePrefix}${prefix}t${tableIndex}(${quotedColumns}) AS (SELECT * FROM (VALUES ${values}) t${tableIndex})`;
    });
    content = ctePrefix + ' ' + content;

    if (DEBUG) {
      console.log(`Interpolated SQL: ${content}`);
    }
  } catch (e) {
    console.error(e);
    throw new Error('Malformed substitution in SQL');
  }

  if (panel.sql.type !== 'in-memory') {
    const connector = connectors[
      +panel.sql.connectorIndex
    ] as Proxy<SQLConnectorInfo>;
    connector.server = servers.find(
      (s) => s.id === (panel.serverId || connector.serverId)
    );

    return await asyncRPC<Proxy<SQLConnectorInfo>, string, Array<object>>(
      'evalSQL',
      content,
      connector
    );
  }

  let sql = (window as any).SQL;
  if (!sql) {
    while (!(window as any).initSqlJs) {
      console.log('Waiting for SQL.js to load');
      await new Promise((r) => setTimeout(r, 1000));
    }
    sql = (window as any).SQL = await (window as any).initSqlJs({
      locateFile: (file: string) => `${file}`,
    });
  }

  const db = new sql.Database();
  let res: any;
  res = db.exec(content)[0];

  return res.values.map((row: Array<any>) => {
    const formattedRow: { [k: string]: any } = {};
    res.columns.forEach((c: string, i: number) => {
      formattedRow[c] = row[i];
    });
    return formattedRow;
  });
}

export function SQLPanelDetails({
  panel,
  updatePanel,
}: {
  panel: SQLPanelInfo;
  updatePanel: (d: SQLPanelInfo) => void;
}) {
  const { connectors, servers } = React.useContext(ProjectContext);

  return (
    <React.Fragment>
      <div className="form-row">
        <Select
          label="Vendor"
          value={panel.sql.type}
          onChange={(value: string) => {
            panel.sql.type = value as SQLConnectorInfoType;
            updatePanel(panel);
          }}
        >
          {MODE_FEATURES.sql && <option value="postgres">PostgreSQL</option>}
          {MODE_FEATURES.sql && <option value="mysql">MySQL</option>}
          <option value="in-memory">In-Memory SQL</option>
        </Select>
      </div>
      {MODE_FEATURES.sql && panel.sql.type !== 'in-memory' && (
        <React.Fragment>
          <div className="form-row">
            <Select
              label="Connector"
              value={panel.sql.connectorIndex.toString()}
              onChange={(connectorIndex: string) => {
                panel.sql.connectorIndex = +connectorIndex;
                updatePanel(panel);
              }}
            >
              {connectors
                .map((c: ConnectorInfo, index: number) => {
                  if (
                    c.type !== 'sql' ||
                    (c as SQLConnectorInfo).sql.type !== panel.sql.type
                  ) {
                    return null;
                  }

                  return <option value={index}>{c.name}</option>;
                })
                .filter(Boolean)}
            </Select>
          </div>
          <ServerPicker
            servers={servers}
            serverId={panel.serverId}
            onChange={(serverId: string) => {
              panel.serverId = serverId;
              updatePanel(panel);
            }}
          />
        </React.Fragment>
      )}
    </React.Fragment>
  );
}
