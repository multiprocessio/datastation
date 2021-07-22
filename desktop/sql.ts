import mysql from 'mysql2/promise';
import { Client as PostgresClient } from 'pg';
import sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
import Client from 'ssh2-sftp-client';
import { file as makeTmpFile } from 'tmp-promise';
import { Proxy, SQLConnectorInfo } from '../shared/state';
import { getSSHConfig, tunnel } from './tunnel';

async function evalPostgreSQL(
  content: string,
  host: string,
  port: number,
  { sql }: SQLConnectorInfo
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
    return res.rows;
  } finally {
    await client.end();
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
    password: sql.password,
    database: sql.database,
    port: port,
  });

  try {
    const [rows] = await connection.execute(content);
    return rows;
  } finally {
    connection.end();
  }
}

async function evalSqlite(content: string, info: Proxy<SQLConnectorInfo>) {
  let sqlitefile = info.sql.database;

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
      return await run();
    } finally {
      localCopy.cleanup();
      await sftp.end();
    }
  }

  return await run();
}

const DEFAULT_PORT = {
  postgres: 5432,
  mysql: 3306,
  sqlite: 0,
};

export const evalSQLHandler = {
  resource: 'evalSQL',
  handler: async function (
    _: string,
    content: string,
    info: Proxy<SQLConnectorInfo>
  ) {
    // Sqlite is file, not network based so handle separately.
    if (info.sql.type === 'sqlite') {
      return await evalSqlite(content, info);
    }

    const port = +info.sql.address.split(':')[1] || DEFAULT_PORT[info.sql.type];
    const host = info.sql.address.split(':')[0];

    return await tunnel(
      info.server,
      host,
      port,
      (host: string, port: number): any => {
        if (info.sql.type === 'postgres') {
          return evalPostgreSQL(content, host, port, info);
        }

        if (info.sql.type === 'mysql') {
          return evalMySQL(content, host, port, info);
        }

        throw new Error(`Unknown SQL type: ${info.sql.type}`);
      }
    );
  },
};
