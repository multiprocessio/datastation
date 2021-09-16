import sqlserver from 'mssql';
import mysql from 'mysql2/promise';
import { Client as PostgresClient } from 'pg';
import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
import Client from 'ssh2-sftp-client';
import { file as makeTmpFile } from 'tmp-promise';
import { Proxy, SQLConnectorInfo, SQLPanelInfo } from '../../shared/state';
import { decrypt } from '../secret';
import { rpcEvalHandler } from './eval';
import { getSSHConfig, tunnel } from './tunnel';

async function evalPostgreSQL(
  content: string,
  host: string,
  port: number,
  { connector: { sql } }: Proxy<SQLPanelInfo, SQLConnectorInfo>
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
  { connector: { sql } }: Proxy<SQLPanelInfo, SQLConnectorInfo>
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
  { connector: { sql } }: Proxy<SQLPanelInfo, SQLConnectorInfo>
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
  { connector: { sql } }: Proxy<SQLPanelInfo, SQLConnectorInfo>
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
  info: Proxy<SQLPanelInfo, SQLConnectorInfo>
) {
  let sqlitefile = info.connector.sql.database;

  async function run() {
    const db = await sqlite.open({
      filename: sqlitefile,
      driver: sqlite3.Database,
    });
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

export const evalSQLHandler = rpcEvalHandler({
  resource: 'evalSQL',
  handler: async function (
    projectId: string,
    content: string,
    info: Proxy<SQLPanelInfo, SQLConnectorInfo>
  ) {
    // TODO: need to handle DM_getPanel here
    // TODO:!!!
    // TODO:!!!

    info.connector.sql.password = await decrypt(info.connector.sql.password);

    // Sqlite is file, not network based so handle separately.
    if (info.sql.type === 'sqlite') {
      return await evalSqlite(content, info);
    }

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
  },
});
