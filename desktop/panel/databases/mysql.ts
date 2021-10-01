import mysql from 'mysql2/promise';
import { ANSI_SQL_QUOTE } from '../../../shared/sql';
import { DatabaseConnectorInfo } from '../../../shared/state';
import { Dispatch } from '../../rpc';
import { importAndRun, PanelToImport } from './sqlutil';

export async function evalMySQL(
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
