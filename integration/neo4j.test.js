const fs = require('fs');

const { getProjectResultsFile } = require('../desktop/store');
const {
  Encrypt,
  DatabasePanelInfo,
  DatabaseConnectorInfo,
} = require('../shared/state');
const { withSavedPanels, RUNNERS } = require('../desktop/panel/testutil');
const { withDocker } = require('./testutil');

describe('basic neo4j tests', () => {
  test('basic test', async () => {
    await withDocker(
      {
        image: 'docker.io/library/neo4j:latest',
        port: 7687,
        env: {
          NEO4J_AUTH: 'neo4j/password',
        },
        cmds: [
          `bin/cypher-shell -u neo4j -p password "CREATE (u:User { name : 'test' });"`,
        ],
      },
      async () => {
        const connectors = [
          new DatabaseConnectorInfo({
            type: 'neo4j',
            database: '',
            username: 'neo4j',
            password_encrypt: new Encrypt('password'),
          }),
        ];
        const dp = new DatabasePanelInfo();
        dp.database.connectorId = connectors[0].id;
        dp.content = 'MATCH (n) RETURN count(n) AS count';

        let finished = false;
        const panels = [dp];
        await withSavedPanels(
          panels,
          async (project) => {
            const panelValueBuffer = fs.readFileSync(
              getProjectResultsFile(project.projectName) + dp.id
            );

            const v = JSON.parse(panelValueBuffer.toString());
            expect(v).toStrictEqual([{ count: 1 }]);

            finished = true;
          },
          {
            evalPanels: true,
            connectors,
            subprocessName: RUNNERS.find((r) => r?.go),
          }
        );

        if (!finished) {
          throw new Error('Callback did not finish');
        }
      }
    );
  }, 30_000);
});
