const path = require('path');
const { CODE_ROOT } = require('../constants');
const { getProjectResultsFile } = require('../store');
const { ensureSigningKey } = require('../secret');
const fs = require('fs');
const {
  LiteralPanelInfo,
  Encrypt,
  DatabasePanelInfo,
  DatabaseConnectorInfo,
} = require('../../shared/state');
const { withSavedPanels, RUNNERS } = require('./testutil');

const DATABASES = [
  {
    type: 'postgres',
    query: `SELECT 1 AS "1", 2.2 AS "2", true AS "true", 'string' AS "string", CAST('2021-01-01' AS DATE) AS "date"`,
  },
  {
    type: 'sqlserver',
    // SQL Server doesn't have true/false literals
    query: `SELECT 1 AS "1", 2.2 AS "2", 1 AS "true", 'string' AS "string", CAST('2021-01-01' AS DATE) AS "date"`,
  },
  {
    type: 'sqlite',
    query: `SELECT 1 AS "1", 2.2 AS "2", true AS "true", 'string' AS "string", DATE('2021-01-01') AS "date"`,
  },
  {
    type: 'mysql',
    query:
      'SELECT 1 AS `1`, 2.2 AS `2`, true AS `true`, "string" AS `string`, CAST("2021-01-01" AS DATE) AS `date`',
  },
  {
    type: 'oracle',
    query:
      // Oracle does not have true/false literals
      // Oracle doesn't support no-FROM. But the dual table is a dummy table.
      `SELECT 1 AS "1", 2.2 AS "2", 3.9 AS "testfloatagain", 1 / 3 AS "testfloatagainagain", 1 AS "true", 'string' AS "string", TO_DATE('2021-01-01','YYYY-MM-DD') AS "date" FROM dual`,
  },
  {
    type: 'postgres',
    query: 'SELECT name, CAST(age AS INT) - 10 AS age FROM DM_getPanel(0)',
  },
  {
    type: 'sqlite',
    query: 'SELECT name, CAST(age AS INT) - 10 AS age FROM DM_getPanel(0)',
  },
  {
    type: 'mysql',
    query: 'SELECT name, CAST(age AS SIGNED) - 10 AS age FROM DM_getPanel(0)',
  },
];

ensureSigningKey();

const vendorOverride = {
  postgres: {
    address: 'localhost?sslmode=disable',
  },
  oracle: {
    database: 'XEPDB1',
  },
  sqlserver: {
    address: 'localhost',
    username: 'sa',
    password: '1StrongPwd!!',
    database: 'master',
  },
};

for (const subprocess of RUNNERS) {
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

          const lp = new LiteralPanelInfo();
          lp.literal.contentTypeInfo = { type: 'text/csv' };
          lp.content = 'age,name\n19,Kate\n20,Bake';

          const connectors = [
            new DatabaseConnectorInfo({
              type: t.type,
              database: vendorOverride[t.type]?.database || 'test',
              address: vendorOverride[t.type]?.address || 'localhost',
              username: vendorOverride[t.type]?.username || 'test',
              password_encrypt: new Encrypt(
                vendorOverride[t.type]?.password || 'test'
              ),
            }),
          ];
          const dp = new DatabasePanelInfo();
          dp.database.connectorId = connectors[0].id;
          dp.content = t.query;

          let finished = false;
          const panels = [lp, dp];
          try {
            await withSavedPanels(
              panels,
              async (project) => {
                const panelValueBuffer = fs.readFileSync(
                  getProjectResultsFile(project.projectName) + dp.id
                );

                const v = JSON.parse(panelValueBuffer.toString());
                if (t.query.startsWith('SELECT 1')) {
                  expect(v.length).toBe(1);
                  // These database drivers are all over the place between Node and Go.
                  // Close enough is fine I guess.
                  expect(v[0]['1']).toBe(1);
                  expect(String(v[0]['2'])).toBe('2.2');
                  expect(v[0]['true'] == '1').toBe(true);
                  expect(v[0].string).toBe('string');
                  expect(new Date(v[0].date)).toStrictEqual(
                    new Date('2021-01-01')
                  );
                } else {
                  expect(v).toStrictEqual([
                    { name: 'Kate', age: 9 },
                    { name: 'Bake', age: 10 },
                  ]);
                }

                finished = true;
              },
              { evalPanels: true, connectors, subprocessName: subprocess }
            );

            if (!finished) {
              throw new Error('Callback did not finish');
            }
          } finally {
            // Delete sqlite file
            if (t.type === 'sqlite') {
              try {
                fs.unlinkSync('test');
              } catch (e) {
                console.error(e);
              }
            }
          }
          // sqlserver at least can take longer than 5s to fail
        }, 30_000);
      }
    );
  }
}
