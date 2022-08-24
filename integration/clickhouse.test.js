const cp = require('child_process');

const { basicDatabaseTest } = require('../desktop/panel/testutil');
const { withDocker } = require('./docker');

const BASIC_TESTS = [
  {
    type: 'clickhouse',
    query: `SELECT 1 AS "1", 2.2 AS "2", true AS "true", 'string' AS "string", parseDateTimeBestEffortOrNull('2021-01-01') AS "date"`,
  },
];

describe('basic clickhouse tests', () => {
  for (const t of BASIC_TESTS) {
    test(
      t.query,
      async () => {
        await withDocker(
          {
            image: 'docker.io/yandex/clickhouse-server:c739327b5607',
            port: 9000,
            args: [
              '-v',
              __dirname +
                '/../scripts/ci/clickhouse_users.xml:/etc/clickhouse-server/users.d/test.xml',
              '--ulimit',
              'nofile=262144:262144',
            ],
            cmds: [`clickhouse-client -q 'CREATE DATABASE test'`],
          },
          async () => {
            // Try weird stuff
            await new Promise((r) => setTimeout(r, 5000));
            return basicDatabaseTest(t);
          }
        );
      },
      360_000 * 10
    );
  }
});
