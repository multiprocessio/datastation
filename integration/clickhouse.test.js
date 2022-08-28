const path = require('path');
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
            image: 'docker.io/yandex/clickhouse-server:22',
            port: 9000,
            args: [
              '-v',
              path.join(
                __dirname,
                '..',
                'scripts/ci/:/etc/clickhouse-server/users.d/'
              ),
            ],
            cmds: [
              `clickhouse-client -q 'CREATE DATABASE test'`,
            ],
          },
          () =>
            basicDatabaseTest(t, {
              clickhouse: {
                database: 'test',
                username: 'test',
                password: 'test',
                address: 'localhost',
              },
            })
        );
      },
      360_000
    );
  }
});
