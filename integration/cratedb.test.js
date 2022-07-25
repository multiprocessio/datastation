const { basicDatabaseTest } = require('../desktop/panel/testutil');
const { withDocker } = require('./testutil');

const BASIC_TESTS = [
  {
    type: 'crate',
    query: `SELECT 1 AS "1", 2.2 AS "2", true AS "true", 'string' AS "string", CAST('2021-01-01' AS DATE) AS "date"`,
  },
];

const vendorOverride = {
  crate: {
    address: 'localhost:5439?sslmode=disable',
    database: 'doc',
  },
};

describe('basic cratedb tests', () => {
  for (const t of BASIC_TESTS) {
    test(
      t.query,
      async () => {
        await withDocker(
          {
            image: 'docker.io/library/crate:latest',
            port: '5439:5432',
            program: ['crate', '-Cdiscovery.type=single-node'],
            cmds: [
              `crash -c "CREATE USER test WITH (password = 'test');"`,
              `crash -c "GRANT ALL PRIVILEGES ON SCHEMA doc TO test;"`,
            ],
          },
          () => basicDatabaseTest(t, vendorOverride)
        );
      },
      360_000
    );
  }
});
