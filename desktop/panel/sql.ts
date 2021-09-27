import { ClickHouse } from 'clickhouse';
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
import { streamArray } from 'stream-json/streamers/StreamArray';
import Batch from 'stream-json/utils/Batch';
import { file as makeTmpFile } from 'tmp-promise';
import {
  NotAnArrayOfObjectsError,
  UnsupportedError,
} from '../../shared/errors';
import log from '../../shared/log';
import {
  ProjectState,
  SQLConnectorInfo,
  SQLPanelInfo,
} from '../../shared/state';
import { Dispatch } from '../rpc';
import { decrypt } from '../secret';
import { getProjectResultsFile } from '../store';
import { getSSHConfig, tunnel } from './tunnel';
import { EvalHandlerExtra, EvalHandlerResponse, guardPanel } from './types';

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
  { sql }: SQLConnectorInfo
) {
  const client = new PostgresClient({
    user: sql.username,
    password: sql.password.value,
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
  { sql }: SQLConnectorInfo
) {
  const client = await sqlserver.connect({
    user: sql.username,
    password: sql.password.value,
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
  { sql }: SQLConnectorInfo
) {
  const oracledb = require('oracledb');
  oracledb.outFormat = oracledb.OBJECT;
  const client = await oracledb.getConnection({
    user: sql.username,
    password: sql.password.value,
    connectString: `${host}:${port}/${sql.database}`,
  });

  while (content.endsWith(';')) {
    content = content.slice(0, -1);
  }

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
  { sql }: SQLConnectorInfo
) {
  const connection = await mysql.createConnection({
    host: host,
    user: sql.username,
    password: sql.password.value,
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

async function evalClickHouse(
  content: string,
  host: string,
  port: number,
  { sql }: SQLConnectorInfo
) {
  let protocol = 'http:';
  if (host.startsWith('http://')) {
    host = host.slice('http://'.length);
  } else if (host.startsWith('https://')) {
    protocol = 'https:';
    host = host.slice('https://'.length);
  }

  const connection = new ClickHouse({
    host,
    port,
    protocol,
    dataObjects: true,
    basicAuth: sql.username
      ? {
          username: sql.username,
          password: sql.password.value,
        }
      : null,
    config: {
      database: sql.database,
    },
  });

  const rows = await connection.query(content).toPromise();
  return { value: rows };
}

async function evalSnowflake(content: string, { sql }: SQLConnectorInfo) {
  // Bundling this in creates issues with openid-connect
  // https://github.com/sindresorhus/got/issues/1018
  // So import it dynamically.
  const snowflake = require('snowflake-sdk');
  const connection = snowflake.createConnection({
    account: sql.extra.account,
    database: sql.database,
    username: sql.username,
    password: sql.password.value,
  });

  const conn: any = await new Promise((resolve, reject) => {
    try {
      connection.connect((err: Error, conn: any) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(conn);
      });
    } catch (e) {
      reject(e);
    }
  });

  const rows = await new Promise((resolve, reject) => {
    try {
      conn.execute({
        sqlText: content,
        complete: (err: Error, stmt: any, rows: Array<any> | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(rows);
        },
      });
    } catch (e) {
      reject(e);
    }
  });

  return { value: rows };
}

export function formatSQLiteImportQueryAndRows(
  tableName: string,
  columns: Array<{ name: string }>,
  data: Array<{ value: any }>
): [string, Array<any>] {
  const columnsDDL = columns.map((c) => `'${c.name}'`).join(', ');
  const values = data
    .map(({ value: row }) => '(' + columns.map((c) => '?') + ')')
    .join(', ');
  const query = `INSERT INTO ${tableName} (${columnsDDL}) VALUES ${values};`;
  const rows = data
    .map(({ value: row }) => columns.map((c) => row[c.name]))
    .flat();
  return [query, rows];
}

async function sqliteImportAndRun(
  db: sqlite.Database,
  projectId: string,
  panel: SQLPanelInfo,
  query: string,
  panelsToImport: Array<PanelToImport>
) {
  for (const panel of panelsToImport) {
    const ddlColumns = panel.columns
      .map((c) => `${c.name} ${c.type}`)
      .join(', ');
    log.info('Creating temp table ' + panel.tableName);
    await db.exec(`CREATE TEMPORARY TABLE ${panel.tableName} (${ddlColumns});`);

    const panelResultsFile = getProjectResultsFile(projectId) + panel.panelId;

    await new Promise((resolve, reject) => {
      try {
        const pipeline = chain([
          fs.createReadStream(panelResultsFile),
          json.parser(),
          streamArray(),
          new Batch({ batchSize: 1000 }),
          async (data: Array<{ value: any }>) => {
            const [query, rows] = formatSQLiteImportQueryAndRows(
              panel.tableName,
              panel.columns,
              data
            );
            await db.run(query, ...rows);
          },
        ]);
        pipeline.on('error', reject);
        pipeline.on('finish', resolve);
      } catch (e) {
        reject(e);
      }
    });
  }

  if (panelsToImport.length) {
    log.info('Done ingestion');
  }

  return db.all(query);
}

async function evalSQLite(
  query: string,
  info: SQLPanelInfo,
  connector: SQLConnectorInfo,
  projectId: string,
  panelsToImport: Array<PanelToImport>,
  dispatch: Dispatch
) {
  let sqlitefile = connector.sql.database;

  async function run() {
    const db = await sqlite.open({
      filename: sqlitefile,
      driver: sqlite3.Database,
    });

    try {
      return await sqliteImportAndRun(
        db,
        projectId,
        info,
        query,
        panelsToImport
      );
    } finally {
      try {
        await db.close();
      } catch (e) {
        console.error(e);
      }
    }
  }

  if (info.serverId) {
    const localCopy = await makeTmpFile();
    const config = await getSSHConfig(dispatch, projectId, info.serverId);

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
  clickhouse: 8123,
  cassandra: 9160,
  snowflake: 443,
  presto: 8080,
};

export async function evalSQL(
  project: ProjectState,
  panel: PanelInfo,
  extra: EvalHandlerExtra,
  dispatch: Dispatch
): Promise<EvalHandlerResponse> {
  const { content: query } = panel;
  const info = guardPanel<SQLPanelInfo>(panel, 'sql');

  const { query, panelsToImport } = transformDM_getPanelCalls(
    content,
    extra.indexShapeMap,
    extra.indexIdMap
  );

  const connectors = (project.connectors || []).filter(
    (c) => c.id === info.sql.connectorId
  );
  if (!connectors.length) {
    throw new Error(`No such connector: ${info.sql.connectorId}.`);
  }
  const connector = connectors[0] as SQLConnectorInfo;

  // SQLite is file, not network based so handle separately.
  if (info.sql.type === 'sqlite') {
    return await evalSQLite(
      query,
      info,
      // ./filagg.ts doesn't add a connector to the project. Just passes info in directly
      connector,
      projectId,
      panelsToImport,
      dispatch
    );
  }

  if (panelsToImport.length) {
    throw new UnsupportedError(
      'DM_getPanel() is not yet supported by this connector.'
    );
  }

  if (connector.sql.password.encrypted) {
    if (!connector.sql.password.value) {
      connector.sql.password.value = undefined;
      connector.sql.password.encrypted = true;
    }
    connector.sql.password.value = await decrypt(connector.sql.password.value);
    connector.sql.password.encrypted = false;
  }

  if (info.sql.type === 'snowflake') {
    return await evalSnowflake(content, connector);
  }

  // TODO: this needs to be more robust. Not all systems format ports the same way
  const port =
    +connector.sql.address.split(':')[1] || DEFAULT_PORT[info.sql.type];
  const host = connector.sql.address.split(':')[0];

  // The way hosts are formatted is unique so have sqlserver manage its own call to tunnel()
  if (info.sql.type === 'sqlserver') {
    return await tunnel(
      dispatch,
      projectId,
      info.serverId,
      host.split('\\')[0],
      port,
      (host: string, port: number): any =>
        evalSQLServer(content, host, port, connector)
    );
  }

  return await tunnel(
    dispatch,
    projectId,
    info.serverId,
    host,
    port,
    (host: string, port: number): any => {
      if (info.sql.type === 'postgres') {
        return evalPostgreSQL(content, host, port, connector);
      }

      if (info.sql.type === 'oracle') {
        return evalOracle(content, host, port, connector);
      }

      if (info.sql.type === 'mysql') {
        return evalMySQL(content, host, port, connector);
      }

      if (info.sql.type === 'clickhouse') {
        return evalClickHouse(content, host, port, connector);
      }

      throw new Error(`Unknown SQL type: ${info.sql.type}`);
    }
  );
}
