import { ClickHouse } from 'clickhouse';
import { DatabaseConnectorInfo } from '../../../shared/state';

export async function evalClickHouse(
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
