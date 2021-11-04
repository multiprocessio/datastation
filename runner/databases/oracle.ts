import { DatabaseConnectorInfo } from '@datastation/shared/state';

export async function evalOracle(
  content: string,
  host: string,
  port: number,
  { database }: DatabaseConnectorInfo
) {
  const oracledb = require('oracledb');
  oracledb.outFormat = oracledb.OBJECT;
  const client = await oracledb.getConnection({
    user: database.username,
    password: database.password_encrypt.value,
    connectString: `${host}:${port}/${database.database}`,
  });

  while (content.endsWith(';')) {
    content = content.slice(0, -1);
  }

  try {
    const res = await client.execute(content);
    return { value: res.rows };
  } finally {
    await client.close();
  }
}
