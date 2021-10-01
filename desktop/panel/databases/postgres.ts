import { Client as PostgresClient } from 'pg';
import { ANSI_SQL_QUOTE } from '../../../shared/sql';
import { DatabaseConnectorInfo } from '../../../shared/state';
import { Dispatch } from '../../rpc';
import { importAndRun, PanelToImport } from './sqlutil';

function replaceQuestionWithDollarCount(query: string) {
  // Replace ? with $1, and so on
  let i = 1;
  return query.replace(/\?/g, function () {
    return `$${i++}`;
  });
}

export async function evalPostgres(
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
