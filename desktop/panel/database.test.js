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
    query: 'SELECT 1 AS "1"',
  },
  {
    type: 'mysql',
    query: 'SELECT 1 AS "1"',
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
  { node: path.join(CODE_ROOT, 'build', 'desktop_runner.js') },
  { go: path.join(CODE_ROOT, 'build', 'go_desktop_runner') },
]) {
  for (const t of DATABASES) {
    describe(
      t.type + 'running via ' + (subprocess.node || subprocess.go),
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
              address: 'localhost',
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

              expect(JSON.parse(panelValueBuffer.toString())).toStrictEqual(
                t.query === 'SELECT 1'
                  ? { 1: 1 }
                  : [
                      { name: 'Kate', age: 9 },
                      { name: 'Bake', age: 10 },
                    ]
              );

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
