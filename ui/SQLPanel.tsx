import * as React from 'react';

import {
  ConnectorInfo,
  SQLConnectorInfo,
  SQLConnectorInfoType,
  SQLPanelInfo,
} from './../shared/state';
import { MODE_FEATURES } from '../shared/constants';

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
  const matcher = /DM_getPanel\(([0-9]+)\)/;
  let content = panel.content;
  try {
    let replacements: Array<number> = [];
    content = content.replace(matcher, function (match, panelIndex) {
      replacements.push(+panelIndex);
      return `t${replacements.length - 1}`;
    });

    replacements.forEach((panelIndex: number, tableIndex: number) => {
      const results = panelResults[panelIndex];
      if (results.exception || results.value.length === 0) {
        // TODO: figure out how to query empty panels. (How to resolve column names for SELECT?)
        throw new Error('Cannot query empty results in panel ${panelIndex}');
      }
      const columns = Object.keys(results.value[0]);
      const valuesAsSQLStrings = results.value.map(
        (row: { [k: string]: any }) => {
          return columns.map((column: string) => {
            const cell = row[column];
            if (typeof cell === 'number' || typeof cell === 'boolean') {
              return cell.toString();
            }

            // Default to stringifying.
            const stringified = JSON.stringify(cell);
            if (!stringified) {
              return 'null';
            }

            // JSON strings use double quote, SQL uses single quote
            if (stringified[0] === '"') {
              const replace = stringified.split('');
              replace[0] = "'";
              replace[replace.length - 1] = "'";
              return replace.join('');
            }

            return `'${stringified}'`;
          });
        }
      );
      const quotedColumns = columns
        .map((c: string) => `'${c.replace("'", "\\'")}'`)
        .join(',');
      const values = valuesAsSQLStrings
        .map((v: Array<string>) => `(${v.join(', ')})`)
        .join(', ');
      content = `WITH t${tableIndex}(${quotedColumns}) AS (SELECT * FROM (VALUES ${values})) ${content}`;
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

  if (panel.sql.sql.type === 'in-memory') {
    let sql = (window as any).SQL;
    if (!sql) {
      sql = (window as any).SQL = await (window as any).initSqlJs({
        locateFile: (file: string) => `${file}`,
      });
    }

    const db = new sql.Database();
    let res: any;
    try {
      res = db.exec(content)[0];
    } catch (e) {
      console.error(e, content);
      throw new Error('Syntax error');
    }

    return res.values.map((row: Array<any>) => {
      const formattedRow: { [k: string]: any } = {};
      res.columns.forEach((c: string, i: number) => {
        formattedRow[c] = row[i];
      });
      return formattedRow;
    });
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
            panel.sql.sql.type = value as SQLConnectorInfoType;
            updatePanel(panel);
          }}
        >
          {MODE_FEATURES.sql && <option value="postgres">PostgreSQL</option>}
          <option value="in-memory">In-Memory SQL</option>
        </Select>
        {MODE_FEATURES.sql && (
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
        )}
      </div>
    </React.Fragment>
  );
}
