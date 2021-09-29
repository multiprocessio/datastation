import { ClickHouse } from 'clickhouse';
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
import { file as makeTmpFile } from 'tmp-promise';
import { chunk } from '../../shared/array';
import {
  NotAnArrayOfObjectsError,
  UnsupportedError,
} from '../../shared/errors';
import log from '../../shared/log';
import {
  ANSI_SQL_QUOTE,
  quote,
  QuoteType,
  sqlRangeQuery,
} from '../../shared/sql';
import {
  DatabaseConnectorInfo,
  DatabasePanelInfo,
  PanelInfo,
  ProjectState,
  TimeSeriesRange,
} from '../../shared/state';
import { Dispatch } from '../rpc';
import { decrypt } from '../secret';
import { getPanelResult } from './shared';
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
  id: string;
  columns: Array<{ name: string; type: string }>;
  tableName: string;
}

export function transformDM_getPanelCalls(
  query: string,
  indexShapeMap: Array<Shape>,
  indexIdMap: Array<string>,
  getPanelCallsAllowed: boolean
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

      const id = indexIdMap[+panelSource];
      if (panelsToImport.filter((p) => id === p.id).length) {
        // Don't import the same panel twice.
        return;
      }

      const tableName = `t${panelSource}`;
      const columns = sqlColumnsAndTypesFromShape(rowShape);
      panelsToImport.push({
        id,
        columns,
        tableName,
      });
      return tableName;
    }
  );

  if (panelsToImport.length && !getPanelCallsAllowed) {
    throw new UnsupportedError(
      'DM_getPanel() is not yet supported by this connector.'
    );
  }

  return { panelsToImport, query };
}

export function replaceQuestionWithDollarCount(query: string) {
  // Replace ? with $1, and so on
  let i = 1;
  return query.replace(/\?/g, function () {
    return `$${i++}`;
  });
}

async function evalPostgreSQL(
  dispatch: Dispatch,
  query: string,
  host: string,
  port: number,
  info: DatabaseConnectorInfo,
  projectId: string,
  panelsToImport: Array<PanelToImport>
) {
  query = replaceQuestionWithDollarCount(query);
  const client = new PostgresClient({
    user: info.database.username,
    password: info.database.password_encrypt.value,
    database: info.database.database,
    host,
    port,
  });
  try {
    await client.connect();
    const { rows } = await importAndRun(
      dispatch,
      {
        createTable: (stmt: string) => client.query(stmt),
        insert: (stmt: string, values: any[]) => client.query(stmt, values),
        query: (stmt: string) => client.query(stmt),
      },
      projectId,
      query,
      panelsToImport,
      ANSI_SQL_QUOTE,
      replaceQuestionWithDollarCount
    );
    return {
      value: rows,
    };
  } finally {
    await client.end();
  }
}

async function evalSQLServer(
  content: string,
  host: string,
  port: number,
  { database }: DatabaseConnectorInfo
) {
  const client = await sqlserver.connect({
    user: database.username,
    password: database.password_encrypt.value,
    database: database.database,
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
  { database }: DatabaseConnectorInfo
) {
  const oracledb = require('oracledb');
  oracledb.outFormat = oracledb.OBJECT;
  const client = await oracledb.getConnection({
    user: database.username,
    password: database.password_encrypt.value,
    connectString: `${host}:${port}/${database.database}`,
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
  dispatch: Dispatch,
  query: string,
  host: string,
  port: number,
  info: DatabaseConnectorInfo,
  projectId: string,
  panelsToImport: Array<PanelToImport>
) {
  const connection = await mysql.createConnection({
    host: host,
    user: info.database.username,
    password: info.database.password_encrypt.value,
    database: info.database.database,
    port: port,
  });

  try {
    const [value] = await importAndRun(
      dispatch,
      {
        createTable: (stmt: string) => connection.execute(stmt),
        insert: (stmt: string, values: any[]) =>
          connection.execute(stmt, values),
        query: (stmt: string) => connection.execute(stmt),
      },
      projectId,
      query,
      panelsToImport,
      ANSI_SQL_QUOTE
    );
    return { value };
  } finally {
    connection.end();
  }
}

async function evalClickHouse(
  content: string,
  host: string,
  port: number,
  { database }: DatabaseConnectorInfo
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
    basicAuth: database.username
      ? {
          username: database.username,
          password: database.password_encrypt.value,
        }
      : null,
    config: {
      database: database.database,
    },
  });

  const rows = await connection.query(content).toPromise();
  return { value: rows };
}

async function evalSnowflake(
  content: string,
  { database }: DatabaseConnectorInfo
) {
  // Bundling this in creates issues with openid-connect
  // https://github.com/sindresorhus/got/issues/1018
  // So import it dynamically.
  const snowflake = require('snowflake-sdk');
  const connection = snowflake.createConnection({
    account: database.extra.account,
    database: database.database,
    username: database.username,
    password: database.password_encrypt.value,
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

export function formatImportQueryAndRows(
  tableName: string,
  columns: Array<{ name: string }>,
  data: Array<any>,
  quoteType: QuoteType
): [string, Array<any>] {
  const columnsDDL = columns
    .map((c) => quote(c.name, quoteType.identifier))
    .join(', ');
  const values = data
    .map((row) => '(' + columns.map((c) => '?').join(', ') + ')')
    .join(', ');
  const query = `INSERT INTO ${quote(
    tableName,
    quoteType.identifier
  )} (${columnsDDL}) VALUES ${values};`;
  const rows = data.map((row) => columns.map((c) => row[c.name])).flat();
  return [query, rows];
}

export async function importAndRun(
  dispatch: Dispatch,
  db: {
    createTable: (stmt: string) => Promise<unknown>;
    insert: (stmt: string, values: any[]) => Promise<unknown>;
    query: (stmt: string) => Promise<any>;
  },
  projectId: string,
  query: string,
  panelsToImport: Array<PanelToImport>,
  quoteType: QuoteType,
  // Postgres uses $1, mysql/sqlite use ?
  mangleInsert?: (stmt: string) => string
) {
  let rowsIngested = 0;
  for (const panel of panelsToImport) {
    const ddlColumns = panel.columns
      .map((c) => `${quote(c.name, quoteType.identifier)} ${c.type}`)
      .join(', ');
    log.info('Creating temp table ' + panel.tableName);
    await db.createTable(
      `CREATE TEMPORARY TABLE ${quote(
        panel.tableName,
        quoteType.identifier
      )} (${ddlColumns});`
    );

    const res = await getPanelResult(dispatch, projectId, panel.id);
    const { value } = res;

    for (const data of chunk(value, 1000)) {
      const [query, rows] = formatImportQueryAndRows(
        panel.tableName,
        panel.columns,
        data,
        quoteType
      );
      await db.insert(mangleInsert ? mangleInsert(query) : query, rows);
      rowsIngested += data.length;
    }
  }

  if (panelsToImport.length) {
    log.info(
      `Ingested ${rowsIngested} rows in ${panelsToImport.length} tables.`
    );
  }

  return db.query(query);
}

async function evalSQLite(
  dispatch: Dispatch,
  query: string,
  info: DatabasePanelInfo,
  connector: DatabaseConnectorInfo,
  project: ProjectState,
  panelsToImport: Array<PanelToImport>
) {
  async function run(sqlitefile: string) {
    const db = await sqlite.open({
      filename: sqlitefile,
      driver: sqlite3.Database,
    });

    try {
      return await importAndRun(
        dispatch,
        {
          createTable: (stmt: string) => db.exec(stmt),
          insert: (stmt: string, values: any[]) => db.run(stmt, ...values),
          query: (stmt: string) => db.all(stmt),
        },
        project.projectName,
        query,
        panelsToImport,
        ANSI_SQL_QUOTE
      );
    } finally {
      try {
        await db.close();
      } catch (e) {
        console.error(e);
      }
    }
  }

  const file = connector.database.database;
  if (info.serverId) {
    const localCopy = await makeTmpFile();
    const config = await getSSHConfig(project, info.serverId);

    const sftp = new Client();
    await sftp.connect(config);

    try {
      await sftp.fastGet(file, localCopy.path);
      const value = await run(localCopy.path);
      return { value };
    } finally {
      localCopy.cleanup();
      await sftp.end();
    }
  }

  const value = await run(file);
  return { value };
}

export async function getAndDecryptConnector(
  project: ProjectState,
  connectorId: string
) {
  const connectors = (project.connectors || []).filter(
    (c) => c.id === connectorId
  );
  if (!connectors.length) {
    throw new Error(`No such connector: ${connectorId}.`);
  }
  const connector = connectors[0] as DatabaseConnectorInfo;

  if (connector.database.password_encrypt.encrypted) {
    if (!connector.database.password_encrypt.value) {
      connector.database.password_encrypt.value = undefined;
      connector.database.password_encrypt.encrypted = true;
    }
    connector.database.password_encrypt.value = await decrypt(
      connector.database.password_encrypt.value
    );
    connector.database.password_encrypt.encrypted = false;
  }

  return connector;
}

async function evalElasticsearch(
  query: string,
  range: TimeSeriesRange,
  host: string,
  port: number,
  connector: DatabaseConnectorInfo
): Promise<EvalHandlerResponse> {
  return { value: [] };
}

async function evalSplunk(
  query: string,
  range: TimeSeriesRange,
  host: string,
  port: number,
  connector: DatabaseConnectorInfo
): Promise<EvalHandlerResponse> {
  return { value: [] };
}

async function evalPrometheus(
  query: string,
  range: TimeSeriesRange,
  host: string,
  port: number,
  connector: DatabaseConnectorInfo
): Promise<EvalHandlerResponse> {
  return { value: [] };
}

async function evalInflux(
  query: string,
  range: TimeSeriesRange,
  host: string,
  port: number,
  connector: DatabaseConnectorInfo
): Promise<EvalHandlerResponse> {
  return { value: [] };
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
  elasticsearch: 9200,
  influx: 8086,
  splunk: 443,
  prometheus: 9090,
};

export function portHostFromAddress(
  info: DatabasePanelInfo,
  connector: DatabaseConnectorInfo
) {
  // TODO: this needs to be more robust. Not all systems format ports the same way
  const port =
    +connector.database.address.split(':')[1] ||
    DEFAULT_PORT[info.database.type];
  const host = connector.database.address.split(':')[0];
  return { port, host };
}

export async function evalDatabase(
  project: ProjectState,
  panel: PanelInfo,
  extra: EvalHandlerExtra,
  dispatch: Dispatch
): Promise<EvalHandlerResponse> {
  const { content } = panel;
  const info = guardPanel<DatabasePanelInfo>(panel, 'database');

  const connector = await getAndDecryptConnector(
    project,
    info.database.connectorId
  );

  const serverId = connector.serverId || info.serverId;

  if (
    info.database.type === 'elasticsearch' ||
    info.database.type === 'splunk' ||
    info.database.type === 'prometheus' ||
    info.database.type === 'influx'
  ) {
    const { host, port } = portHostFromAddress(info, connector);
    return await tunnel(
      project,
      serverId,
      host,
      port,
      (host: string, port: number): any => {
        if (info.database.type === 'elasticsearch') {
          return evalElasticsearch(
            content,
            info.database.range,
            host,
            port,
            connector
          );
        }

        if (info.database.type === 'splunk') {
          return evalSplunk(
            content,
            info.database.range,
            host,
            port,
            connector
          );
        }

        if (info.database.type === 'prometheus') {
          return evalPrometheus(
            content,
            info.database.range,
            host,
            port,
            connector
          );
        }

        if (info.database.type === 'influx') {
          return evalInflux(
            content,
            info.database.range,
            host,
            port,
            connector
          );
        }
      }
    );
  }

  const { query, panelsToImport } = transformDM_getPanelCalls(
    content,
    extra.indexShapeMap,
    extra.indexIdMap,
    ['mysql', 'postgres', 'sqlite'].includes(info.database.type)
  );

  const rangeQuery = sqlRangeQuery(
    query,
    info.database.range,
    info.database.type
  );

  // SQLite is file, not network based so handle separately.
  if (info.database.type === 'sqlite') {
    return await evalSQLite(
      dispatch,
      rangeQuery,
      info,
      connector,
      project,
      panelsToImport
    );
  }

  if (info.database.type === 'snowflake') {
    return await evalSnowflake(rangeQuery, connector);
  }

  const { host, port } = portHostFromAddress(info, connector);

  // The way hosts are formatted is unique so have sqlserver manage its own call to tunnel()
  if (info.database.type === 'sqlserver') {
    return await tunnel(
      project,
      serverId,
      host.split('\\')[0],
      port,
      (host: string, port: number): any =>
        evalSQLServer(rangeQuery, host, port, connector)
    );
  }

  return await tunnel(
    project,
    serverId,
    host,
    port,
    (host: string, port: number): any => {
      if (info.database.type === 'postgres') {
        return evalPostgreSQL(
          dispatch,
          rangeQuery,
          host,
          port,
          connector,
          project.projectName,
          panelsToImport
        );
      }

      if (info.database.type === 'mysql') {
        return evalMySQL(
          dispatch,
          rangeQuery,
          host,
          port,
          connector,
          project.projectName,
          panelsToImport
        );
      }

      if (info.database.type === 'oracle') {
        return evalOracle(rangeQuery, host, port, connector);
      }

      if (info.database.type === 'clickhouse') {
        return evalClickHouse(rangeQuery, host, port, connector);
      }

      throw new Error(`Unknown SQL type: ${info.database.type}`);
    }
  );
}
