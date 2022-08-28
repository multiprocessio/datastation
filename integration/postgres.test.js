const { basicDatabaseTest } = require('../desktop/panel/testutil');
const { withDocker } = require('./docker');

const BASIC_TESTS = [
  {
    type: 'postgres',
    query: `SELECT 1 AS "1", 2.2 AS "2", true AS "true", 'string' AS "string", CAST('2021-01-01' AS DATE) AS "date"`,
  },
  {
    type: 'postgres',
    query:
      'SELECT name, CAST(age AS INT) - 10 AS age, "location.city" AS city FROM DM_getPanel(0)',
  },
];

const vendorOverride = {
  postgres: {
    address: 'localhost?sslmode=disable',
  },
};

describe('basic postgres tests', () => {
  for (const t of BASIC_TESTS) {
    test(
      t.query,
      async () => {
        await withDocker(
          {
            image: 'docker.io/library/postgres:14',
            port: '5432',
            env: {
              POSTGRES_USER: 'test',
              POSTGRES_DB: 'test',
              POSTGRES_PASSWORD: 'test',
            },
          },
          () => basicDatabaseTest(t, vendorOverride)
        );
      },
      360_000
    );
  }
});
