import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
import Client from 'ssh2-sftp-client';
import { file as makeTmpFile } from 'tmp-promise';
import { ANSI_SQL_QUOTE } from '../../../shared/sql';
import {
  DatabaseConnectorInfo,
  DatabasePanelInfo,
  ProjectState,
} from '../../../shared/state';
import { Dispatch } from '../../rpc';
import { getSSHConfig } from '../tunnel';
import { importAndRun, PanelToImport } from './sqlutil';

export async function evalSQLite(
  dispatch: Dispatch,
  query: string,
  info: DatabasePanelInfo,
  connector: DatabaseConnectorInfo,
  project: ProjectState,
  panelsToImport: Array<PanelToImport>
) {
  async function run(sqlitefile: string) {
    const db = await sqlite.open({
      filename: sqlitefile,
      driver: sqlite3.Database,
    });

    try {
      return await importAndRun(
        dispatch,
        {
          createTable: (stmt: string) => db.exec(stmt),
          insert: (stmt: string, values: any[]) => db.run(stmt, ...values),
          query: (stmt: string) => db.all(stmt),
        },
        project.projectName,
        query,
        panelsToImport,
        ANSI_SQL_QUOTE
      );
    } finally {
      try {
        await db.close();
      } catch (e) {
        console.error(e);
      }
    }
  }

  const file = connector.database.database;
  if (info.serverId) {
    const localCopy = await makeTmpFile({ prefix: 'local-sqlite-copy-' });
    const config = await getSSHConfig(project, info.serverId);

    const sftp = new Client();
    await sftp.connect(config);

    try {
      await sftp.fastGet(file, localCopy.path);
      const value = await run(localCopy.path);
      return { value };
    } finally {
      localCopy.cleanup();
      await sftp.end();
    }
  }

  const value = await run(file);
  return { value };
}
