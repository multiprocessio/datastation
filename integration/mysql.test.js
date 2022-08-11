const cp = require('child_process');

const { basicDatabaseTest } = require('../desktop/panel/testutil');
const { withDocker } = require('./docker');

const BASIC_TESTS = [
  {
    type: 'mysql',
    query:
      'SELECT 1 AS `1`, 2.2 AS `2`, true AS `true`, "string" AS `string`, CAST("2021-01-01" AS DATE) AS `date`',
  },
  {
    type: 'mysql',
    query:
      'SELECT name, CAST(age AS SIGNED) - 10 AS age, `location.city` AS city FROM DM_getPanel(0)',
  },
];

describe('basic mysql tests', () => {
  for (const t of BASIC_TESTS) {
    test(
      t.query,
      async () => {
        await withDocker(
          {
            image: 'docker.io/library/mysql:latest',
            port: '3306',
            env: {
              MYSQL_ROOT_PASSWORD: 'root',
            },
            cmds: [
              `mysql -h localhost -uroot -proot --execute="CREATE USER 'test'@'%' IDENTIFIED BY 'test';"`,
              `mysql -h localhost -uroot -proot --execute="CREATE DATABASE test;"`,
              `mysql -h localhost -uroot -proot --execute="GRANT ALL PRIVILEGES ON test.* TO 'test'@'%';"`,
            ],
          },
          () => basicDatabaseTest(t)
        );
      },
      360_000
    );
  }
});
