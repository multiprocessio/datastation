const { basicDatabaseTest } = require('../desktop/panel/testutil');
const { withDocker } = require('./testutil');

const BASIC_TESTS = [
  {
    type: 'sqlserver',
    // SQL Server doesn't have true/false literals
    query: `SELECT 1 AS "1", 2.2 AS "2", 1 AS "true", 'string' AS "string", CAST('2021-01-01' AS DATE) AS "date"`,
  },
];

const vendorOverride = {
  sqlserver: {
    address: 'localhost',
    username: 'sa',
    password: '1StrongPwd!!',
    database: 'master',
  },
};

describe('basic sqlserver tests', () => {
  for (const t of BASIC_TESTS) {
    test(
      t.query,
      async () => {
        await withDocker(
          {
            image: 'mcr.microsoft.com/mssql/server:2019-latest',
            port: '1433',
            env: {
              ACCEPT_EULA: 'Y',
              MSSQL_SA_PASSWORD: '1StrongPwd!!',
            },
            cmds: [
              `/opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P "1StrongPwd!!" -Q "CREATE TABLE master.[dbo].test (id int PRIMARY KEY, name text);"`,
            ],
          },
          () => basicDatabaseTest(t, vendorOverride)
        );
      },
      360_000
    );
  }
});
