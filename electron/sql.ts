export const evalSQLHandler = {
  name: 'evalSQL',
  handler: async function () {
    const port = +panel.sql.sql.address.split(':')[1] || 5432;
    const host = panel.sql.sql.address.split(':')[0];

    const client = new PostgresClient({
      user: panel.sql.sql.username,
      password: panel.sql.sql.password,
      database: panel.sql.sql.database,
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
