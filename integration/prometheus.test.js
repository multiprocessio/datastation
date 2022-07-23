const fs = require('fs');

const fetch = require('node-fetch');

const { getProjectResultsFile } = require('../desktop/store');
const {
  LiteralPanelInfo,
  Encrypt,
  DatabasePanelInfo,
  DatabaseConnectorInfo,
} = require('../shared/state');
const { withSavedPanels, RUNNERS } = require('../desktop/panel/testutil');
const { withDocker } = require('./testutil');

describe('basic prometheus tests', () => {
  test('basic test', async () => {
    if (process.platform !== 'linux') {
      return;
    }

    await withDocker(
      {
        image: 'docker.io/prom/prometheus:latest',
        port: '9090',
        args: ['-v', `${__dirname}/../testdata/prometheus:/etc/prometheus`],
        wait: async () => {
          while (true) {
            try {
              await fetch('localhost:9090');
              break;
            } catch (e) {
              /* pass */
            }
          }
        },
      },
      async () => {
        const connectors = [
          new DatabaseConnectorInfo({
            type: 'prometheus',
            database: '',
          }),
        ];
        const dp = new DatabasePanelInfo();
        dp.database.connectorId = connectors[0].id;
        dp.content = 'up';

        let finished = false;
        const panels = [dp];
        await withSavedPanels(
          panels,
          async (project) => {
            const panelValueBuffer = fs.readFileSync(
              getProjectResultsFile(project.projectName) + dp.id
            );

            const v = JSON.parse(panelValueBuffer.toString());
            expect(v.length).toBeGreaterThan(1);
            expect(v[0]).toStrictEqual({
              metric: {
                __name__: 'up',
                instance: 'localhost:9090',
                job: 'prometheus',
              },
              time: v[0].time,
              value: '1',
            });

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
