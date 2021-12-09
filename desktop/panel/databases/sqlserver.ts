import sqlserver from 'mssql';
import { DatabaseConnectorInfo } from '../../../shared/state';

export async function evalSQLServer(
  content: string,
  host: string,
  port: number,
  { database }: DatabaseConnectorInfo
) {
  const config = {
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
  };
  console.log('DEBUG', config);
  const client = await sqlserver.connect(config);
  try {
    const res = await client.query(content);
    return { value: res.recordset };
  } finally {
    await client.close();
  }
}
