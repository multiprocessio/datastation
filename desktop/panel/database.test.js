const path = require('path');
const { CODE_ROOT } = require('../constants');
const { getProjectResultsFile } = require('../store');
const fs = require('fs');
const {
  LiteralPanelInfo,
  Encrypt,
  DatabasePanelInfo,
  DatabaseConnectorInfo,
} = require('../../shared/state');
const { withSavedPanels } = require('./testutil');

const DATABASES = [
  {
    type: 'postgres',
    query: `SELECT 1 AS "1", 2.2 AS "2", true AS "true", 'string' AS "string", CAST('2021-01-01' AS DATE) AS "date"`,
  },
  {
    type: 'mysql',
    query:
      'SELECT 1 AS `1`, 2.2 AS `2`, true AS `true`, "string" AS `string`, CAST("2021-01-01" AS DATE) AS `date`',
  },
  {
    type: 'postgres',
    query: 'SELECT name, age::INT - 10 AS age FROM DM_getPanel(0)',
  },
  {
    type: 'mysql',
    query: 'SELECT name, CAST(age AS SIGNED) - 10 AS age FROM DM_getPanel(0)',
  },
  // TODO: add sqlite tests
];

for (const subprocess of [
  // undefined // uncomment this for debugging in the local process
  { node: path.join(CODE_ROOT, 'build', 'desktop_runner.js') },
  { go: path.join(CODE_ROOT, 'build', 'go_desktop_runner') },
]) {
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
              database: 'test',
              address:
                'localhost' + (t.type === 'postgres' ? '?sslmode=disable' : ''),
              username: 'test',
              password_encrypt: new Encrypt('test'),
            }),
          ];
          const dp = new DatabasePanelInfo();
          dp.database.connectorId = connectors[0].id;
          dp.content = t.query;

          let finished = false;
          const panels = [lp, dp];
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
        });
      }
    );
  }
}
