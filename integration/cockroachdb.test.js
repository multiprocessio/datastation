const cp = require('child_process');

const { basicDatabaseTest } = require('../desktop/panel/testutil');
const { withDocker } = require('./testutil');

const BASIC_TESTS = [
  {
    type: 'cockroach',
    query: `SELECT 1 AS "1", 2.2 AS "2", true AS "true", 'string' AS "string", CAST('2021-01-01' AS DATE) AS "date"`,
  },
];

describe('basic cockroachdb tests', () => {
  for (const t of BASIC_TESTS) {
    test(
      t.query,
      async () => {
        await withDocker(
          {
            image: 'docker.io/cockroachdb/cockroach:latest',
            port: 26257,
            args: [],
            cmds: [
              `mkdir certs cockroach-safe`,
              `cockroach cert create-ca --certs-dir=certs --ca-key=cockroach-safe/ca.key`,
              `cockroach cert create-node localhost $(hostname) --certs-dir=certs --ca-key=cockroach-safe/ca.key`,
              `cockroach cert create-client root --certs-dir=certs --ca-key=cockroach-safe/ca.key`,
              `cockroach start-single-node --certs-dir=certs --accept-sql-without-tls --background`,
              `cockroach sql --certs-dir=certs --host=localhost:26257 --execute "CREATE DATABASE test; CREATE USER test WITH PASSWORD 'test'; GRANT ALL ON DATABASE test TO test;"`,
            ],
          },
          () => basicDatabaseTest(t)
        );
      },
      360_000
    );
  }
});
