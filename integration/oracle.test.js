// TODO: Support Oracle
if (false) {
  const { basicDatabaseTest } = require('../desktop/panel/testutil');
  const { withDocker, DEFAULT_TIMEOUT } = require('./docker');

  const BASIC_TESTS = [
    {
      type: 'oracle',
      query:
        // Oracle does not have true/false literals
        // Oracle doesn't support no-FROM. But the dual table is a dummy table.
        `SELECT 1 AS "1", 2.2 AS "2", 1 AS "true", 'string' AS "string", TO_DATE('2021-01-01','YYYY-MM-DD') AS "date" FROM dual`,
    },
  ];

  const vendorOverride = {
    oracle: {
      database: 'XEPDB1',
    },
  };

  describe('basic oracle tests', () => {
    for (const t of BASIC_TESTS) {
      test(
        t.query,
        async () => {
          await withDocker(
            {
              image: 'docker.io/gvenzl/oracle-xe:21-slim',
              port: '1521',
              env: {
                ORACLE_RANDOM_PASSWORD: 'y',
                APP_USER: 'test',
                APP_USER_PASSWORD: 'test',
              },
              // TODO: find a better way to wait for oracle to come up
              wait: () => new Promise((r) => setTimeout(r, 60_000)),
            },
            () => basicDatabaseTest(t, vendorOverride)
          );
        },
        DEFAULT_TIMEOUT
      );
    }

    test(
      'alternative port regression test',
      async () => {
        await withDocker(
          {
            image: 'docker.io/gvenzl/oracle-xe:21-slim',
            port: '1520:1521',
            env: {
              ORACLE_RANDOM_PASSWORD: 'y',
              APP_USER: 'test',
              APP_USER_PASSWORD: 'test',
            },
            // TODO: find a better way to wait for oracle to come up
            wait: () => new Promise((r) => setTimeout(r, 60_000)),
          },
          () =>
            basicDatabaseTest(BASIC_TESTS[0], {
              ...vendorOverride,
              oracle: {
                ...vendorOverride.oracle,
                address: 'localhost:1520',
              },
            })
        );
      },
      DEFAULT_TIMEOUT * 10
    );
  });
} else {
  test('ok', function () {});
}
