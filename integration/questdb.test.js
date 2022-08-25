const { basicDatabaseTest } = require('../desktop/panel/testutil');
const { withDocker } = require('./docker');

const BASIC_TESTS = [
  {
    type: 'quest',
    query: `SELECT 1 AS "1", 2.2 AS "2", true AS "true", 'string' AS "string", CAST('2021-01-01' AS TIMESTAMP) AS "date"`,
  },
];

const vendorOverride = {
  quest: {
    address: '?sslmode=disable',
    database: 'qdb',
    username: 'admin',
    password: 'quest',
  },
};

describe('basic questdb tests', () => {
  for (const t of BASIC_TESTS) {
    test(
      t.query,
      async () => {
        await withDocker(
          {
            image: 'docker.io/questdb/questdb:6.5',
            port: '8812',
          },
          () => basicDatabaseTest(t, vendorOverride)
        );
      },
      360_000
    );
  }
});
