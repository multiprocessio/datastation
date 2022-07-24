const path = require('path');
const fs = require('fs');

const { CODE_ROOT } = require('../constants');
const { getProjectResultsFile } = require('../store');
const { ensureSigningKey } = require('../secret');
const {
  LiteralPanelInfo,
  Encrypt,
  DatabasePanelInfo,
  DatabaseConnectorInfo,
} = require('../../shared/state');
const { basicDatabaseTest, withSavedPanels, RUNNERS } = require('./testutil');

const DATABASES = [
  {
    type: 'odbc',
    // SQL Server doesn't have true/false literals
    query: `SELECT 1 AS "1", 2.2 AS "2", 1 AS "true", 'string' AS "string", CAST('2021-01-01' AS DATE) AS "date"`,
  },
  {
    type: 'sqlite',
    query: `SELECT 1 AS "1", 2.2 AS "2", true AS "true", 'string' AS "string", DATE('2021-01-01') AS "date"`,
  },
  {
    type: 'sqlite',
    query:
      'SELECT name, CAST(age AS INT) - 10 AS age, "location.city" AS city FROM DM_getPanel(0)',
  },
  {
    type: 'odbc',
    query: `INSERT INTO test (id, name) VALUES (1, 'name')`,
  },
];

ensureSigningKey();

const vendorOverride = {
  odbc: {
    address: 'localhost',
    username: 'sa',
    password: '1StrongPwd!!',
    database: 'master',
    extra: {
      driver: 'ODBC Driver 18 for SQL Server',
      allow_untrusted: true,
    },
  },
};

for (const subprocess of RUNNERS) {
  // Most databases now only work with the Go runner.
  if (!subprocess?.go) {
    continue;
  }

  for (const t of DATABASES) {
    describe(
      t.type +
        ' running via ' +
        (subprocess ? subprocess.node || subprocess.go : 'process') +
        ': ' +
        t.query,
      () => {
        test(`runs ${t.type} query`, async () => {
          if (process.platform !== 'linux') {
            return;
          }

          await basicDatabaseTest(t, vendorOverride, subprocess);
          // sqlserver takes a while
        }, 30_000);
      }
    );
  }
}
