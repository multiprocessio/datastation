const path = require('path');
const fs = require('fs');
const { getProjectResultsFile } = require('../../store');
const { CODE_ROOT } = require('../../constants');
const {
  Encrypt,
  DatabasePanelInfo,
  DatabaseConnectorInfo,
} = require('../../../shared/state');
const { withSavedPanels } = require('../testutil');

for (const subprocess of [
  undefined,
  { node: path.join(CODE_ROOT, 'build', 'desktop_runner.js') },
  { go: path.join(CODE_ROOT, 'build', 'go_desktop_runner_test') },
]) {
  test(
    'runs clickhouse query via ' +
      (subprocess ? subprocess.node || subprocess.go : 'memory'),
    async () => {
      if (process.platform !== 'linux') {
        return;
      }

      const connectors = [
        new DatabaseConnectorInfo({
          type: 'clickhouse',
          address: 'localhost',
          username: 'test',
          password_encrypt: new Encrypt('test'),
        }),
      ];
      const dp = new DatabasePanelInfo();
      dp.database.connectorId = connectors[0].id;
      dp.content = 'SELECT 42 AS number';

      let finished = false;
      const panels = [dp];
      await withSavedPanels(
        panels,
        async (project) => {
          const panelValueBuffer = fs.readFileSync(
            getProjectResultsFile(project.projectName) + dp.id
          );
          expect(JSON.parse(panelValueBuffer.toString())).toStrictEqual([
            { number: 42 },
          ]);

          finished = true;
        },
        { evalPanels: true, connectors, subprocessName: subprocess }
      );

      if (!finished) {
        throw new Error('Callback did not finish');
      }
    }
  );
}
