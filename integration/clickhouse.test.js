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
            env: {
              CLICKHOUSE_DB: 'test',
              CLICKHOUSE_USER: 'test',
              CLICKHOUSE_PASSWORD: 'test',
            },
            cmds: [
              `clickhouse-client -d test -u test --password test -q 'SELECT 1'`,
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
