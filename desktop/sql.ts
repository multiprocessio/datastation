import util from 'util';

import { Client as PostgresClient } from 'pg';
import mysql from 'mysql2/promise';

import { Proxy, SQLConnectorInfo } from '../shared/state';

import { tunnel } from './tunnel';

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

const DEFAULT_PORT = {
  postgres: 5432,
  mysql: 3306,
  'in-memory': 0,
};

export const evalSQLHandler = {
  resource: 'evalSQL',
  handler: async function (content: string, info: Proxy<SQLConnectorInfo>) {
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
