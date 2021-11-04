import { DatabaseConnectorInfo } from '@datastation/shared/state';
import { fullHttpURL } from '@datastation/shared/url';
import { ClickHouse } from 'clickhouse';

export async function evalClickHouse(
  content: string,
  host: string,
  port: number,
  { database }: DatabaseConnectorInfo
) {
  const { hostname, protocol } = new URL(fullHttpURL(host, port));

  const connection = new ClickHouse({
    host: hostname,
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
