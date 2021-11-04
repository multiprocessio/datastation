import { DatabaseConnectorInfo } from '@datastation/shared/state';

export async function evalSnowflake(
  content: string,
  { database }: DatabaseConnectorInfo
) {
  // Bundling this in creates issues with openid-connect
  // https://github.com/sindresorhus/got/issues/1018
  // So import it dynamically.
  const snowflake = require('snowflake-sdk');
  const connection = snowflake.createConnection({
    account: database.extra.account,
    database: database.database,
    username: database.username,
    password: database.password_encrypt.value,
  });

  const conn: any = await new Promise((resolve, reject) => {
    try {
      connection.connect((err: Error, conn: any) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(conn);
      });
    } catch (e) {
      reject(e);
    }
  });

  const rows = await new Promise((resolve, reject) => {
    try {
      conn.execute({
        sqlText: content,
        complete: (err: Error, stmt: any, rows: Array<any> | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(rows);
        },
      });
    } catch (e) {
      reject(e);
    }
  });

  return { value: rows };
}
