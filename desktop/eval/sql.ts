import fs from 'fs';
import sqlserver from 'mssql';
import mysql from 'mysql2/promise';
import { Client as PostgresClient } from 'pg';
import {
  ArrayShape,
  ObjectShape,
  ScalarShape,
  Shape,
  VariedShape,
} from 'shape';
import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
import Client from 'ssh2-sftp-client';
import { chain } from 'stream-chain';
import * as json from 'stream-json';
import { streamValues } from 'stream-json/streamers/StreamValues';
import { file as makeTmpFile } from 'tmp-promise';
import {
  NotAnArrayOfObjectsError,
  UnsupportedError,
} from '../../shared/errors';
import log from '../../shared/log';
import { SQLEvalBody } from '../../shared/rpc';
import { decrypt } from '../secret';
import { getProjectResultsFile } from '../store';
import { rpcEvalHandler } from './eval';
import { getSSHConfig, tunnel } from './tunnel';

const JSON_SQL_TYPE_MAP: Record<ScalarShape['name'], string> = {
  number: 'REAL',
  string: 'TEXT',
  boolean: 'BOOLEAN',
  bigint: 'BIGINT',
  null: 'TEXT',
};

function sqlColumnsAndTypesFromShape(rowShape: ObjectShape) {
  return Object.keys(rowShape.children).map((key) => {
    const childShape = rowShape.children[key];
    let columnType: null | string = null;

    // Look for simple type: X
    if (childShape.kind === 'scalar') {
      columnType = JSON_SQL_TYPE_MAP[childShape.name];
    }

    // Look for type: null | X
    if (childShape.kind == 'varied') {
      const vs = childShape as VariedShape;
      if (
        vs.children.length === 2 &&
        vs.children.every((c) => c.kind === 'scalar') &&
        vs.children.filter((c) => (c as ScalarShape).name === 'null').length
      ) {
        const nonNullChild = (vs.children as Array<ScalarShape>).filter(
          (c) => c.name !== 'null'
        )[0];
        columnType = JSON_SQL_TYPE_MAP[nonNullChild.name];
      }
    }

    // Otherwise just fall back to being TEXT
    return { name: key, type: columnType || 'TEXT' };
  });
}

interface PanelToImport {
  panelId: string;
  columns: Array<{ name: string; type: string }>;
  tableName: string;
}

export function transformDM_getPanelCalls(
  query: string,
  indexShapeMap: Array<Shape>,
  indexIdMap: Array<string>
): { panelsToImport: Array<PanelToImport>; query: string } {
  const panelsToImport: Array<PanelToImport> = [];
  query = query.replace(
    /DM_getPanel\(([0-9]+)\)/g,
    function (_: string, panelSource: string) {
      const s = indexShapeMap[+panelSource];
      if (!s || s.kind !== 'array') {
        throw new NotAnArrayOfObjectsError(+panelSource);
      }

      const rowShape = (s as ArrayShape).children as ObjectShape;
      if (rowShape.kind !== 'object') {
        throw new NotAnArrayOfObjectsError(+panelSource);
      }

      const columns = sqlColumnsAndTypesFromShape(rowShape);
      const tableName = `t${panelSource}`;
      panelsToImport.push({
        columns,
        tableName,
        panelId: indexIdMap[+panelSource],
      });
      return tableName;
    }
  );

  return { panelsToImport, query };
}

async function evalPostgreSQL(
  content: string,
  host: string,
  port: number,
  { connector: { sql } }: SQLEvalBody
) {
  const client = new PostgresClient({
    user: sql.username,
    password: sql.password,
    database: sql.database,
    host,
    port,
  });
  try {
    await client.connect();
    const res = await client.query(content);
    return {
      value: res.rows,
    };
  } finally {
    await client.end();
  }
}

async function evalSQLServer(
  content: string,
  host: string,
  port: number,
  { connector: { sql } }: SQLEvalBody
) {
  const client = await sqlserver.connect({
    user: sql.username,
    password: sql.password,
    database: sql.database,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    options: {
      encrypt: true,
      trustServerCertificate: host === 'localhost' || host === '127.0.0.1',
    },
    server: host,
    port: port,
  });
  try {
    const res = await client.query(content);
    return { value: res.recordset };
  } finally {
    await client.close();
  }
}

async function evalOracle(
  content: string,
  host: string,
  port: number,
  { connector: { sql } }: SQLEvalBody
) {
  const oracledb = require('oracledb');
  oracledb.outFormat = oracledb.OUT_FORMAT_ARRAY;
  const client = await oracledb.getConnection({
    user: sql.username,
    password: sql.password,
    connectString: `${host}:${port}/${sql.database}`,
  });
  try {
    const res = await client.execute(content);
    return { value: res.rows };
  } finally {
    await client.close();
  }
}

async function evalMySQL(
  content: string,
  host: string,
  port: number,
  { connector: { sql } }: SQLEvalBody
) {
  const connection = await mysql.createConnection({
    host: host,
    user: sql.username,
    password: sql.password,
    database: sql.database,
    port: port,
  });

  try {
    const [value] = await connection.execute(content);
    return { value };
  } finally {
    connection.end();
  }
}

async function evalSqlite(
  content: string,
  info: SQLEvalBody,
  projectId: string,
  panelsToImport: Array<PanelToImport>
) {
  let sqlitefile = info.connector.sql.database;

  async function run() {
    const db = await sqlite.open({
      filename: sqlitefile,
      driver: sqlite3.Database,
    });

    for (const panel of panelsToImport) {
      const ddlColumns = panel.columns
        .map((c) => `${c.name} ${c.type}`)
        .join(', ');
      log.info('Creating temp table ' + panel.tableName);
      await db.exec(
        `CREATE TEMPORARY TABLE ${panel.tableName} (${ddlColumns});`
      );

      const panelResultsFile = getProjectResultsFile(projectId) + panel.panelId;

      await new Promise((resolve, reject) => {
        try {
          const pipeline = chain([
            fs.createReadStream(panelResultsFile),
            json.parser,
            streamValues,
            async (row) => {
              try {
                const columns = panel.columns
                  .map((c) => `'${c.name}'`)
                  .join(', ');
                const values = panel.columns
                  .map((c) => `"${row[c.name]}"`)
                  .join(', ');
                await db.exec(
                  `INSERT INTO ${panel.tableName} (${columns}) VALUES (${values});`
                );
              } catch (e) {
                reject(e);
              }
            },
          ]);
          pipeline.on('end', resolve);
        } catch (e) {
          reject(e);
        }
      });
    }

    if (panelsToImport.length) {
      log.info('Done ingestion');
    }

    return db.all(content);
  }

  if (info.server) {
    const localCopy = await makeTmpFile();
    const config = await getSSHConfig(info.server);

    const sftp = new Client();
    await sftp.connect(config);

    try {
      await sftp.fastGet(sqlitefile, localCopy.path);
      sqlitefile = localCopy.path;
      const value = await run();
      return { value };
    } finally {
      localCopy.cleanup();
      await sftp.end();
    }
  }

  const value = await run();
  return { value };
}

const DEFAULT_PORT = {
  postgres: 5432,
  mysql: 3306,
  sqlite: 0,
  sqlserver: 1433,
  oracle: 1521,
};

export async function evalSQLHandlerInternal(
  projectId: string,
  content: string,
  info: SQLEvalBody
): Promise<{ value: any }> {
  const { query, panelsToImport } = transformDM_getPanelCalls(
    content,
    info.indexShapeMap,
    info.indexIdMap
  );

  // Sqlite is file, not network based so handle separately.
  if (info.sql.type === 'sqlite') {
    return await evalSqlite(query, info, projectId, panelsToImport);
  }

  if (panelsToImport.length) {
    throw new UnsupportedError(
      'DM_getPanel() is not yet supported by this connector.'
    );
  }

  info.connector.sql.password = info.connector.sql.password
    ? await decrypt(info.connector.sql.password)
    : null;

  const port =
    +info.connector.sql.address.split(':')[1] || DEFAULT_PORT[info.sql.type];
  const host = info.connector.sql.address.split(':')[0];

  if (info.sql.type === 'sqlserver') {
    return await tunnel(
      info.server,
      host.split('\\')[0],
      port,
      (host: string, port: number): any =>
        evalSQLServer(content, host, port, info)
    );
  }

  return await tunnel(
    info.server,
    host,
    port,
    (host: string, port: number): any => {
      if (info.sql.type === 'postgres') {
        return evalPostgreSQL(content, host, port, info);
      }

      if (info.sql.type === 'oracle') {
        return evalOracle(content, host, port, info);
      }

      if (info.sql.type === 'mysql') {
        return evalMySQL(content, host, port, info);
      }

      throw new Error(`Unknown SQL type: ${info.sql.type}`);
    }
  );
}

export const evalSQLHandler = rpcEvalHandler({
  resource: 'evalSQL',
  handler: evalSQLHandlerInternal,
});
