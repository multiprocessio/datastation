import { Client as PostgresClient } from 'pg';

import { SQLConnectorInfo } from '../shared/state';

export const evalSQLHandler = {
  resource: 'evalSQL',
  handler: async function (content: string, { sql }: SQLConnectorInfo) {
    const port = +sql.address.split(':')[1] || 5432;
    const host = sql.address.split(':')[0];

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
  },
};
