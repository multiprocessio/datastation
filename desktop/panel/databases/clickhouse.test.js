const { getProjectResultsFile } = require('../store');
const fs = require('fs');
const {
  Encrypt,
  DatabasePanelInfo,
  DatabaseConnectorInfo,
} = require('../../shared/state');
const { withSavedPanels } = require('../testutil');

test(`runs clickhouse query`, async () => {
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
  dp.content = 'SELECT 42';

  let finished = false;
  const panels = [dp];
  await withSavedPanels(
    panels,
    async (project) => {
      const panelValueBuffer = fs.readFileSync(
        getProjectResultsFile(project.projectName) + dp.id
      );
      expect(JSON.parse(panelValueBuffer.toString())).toStrictEqual(42);

      finished = true;
    },
    { evalPanels: true, connectors }
  );

  if (!finished) {
    throw new Error('Callback did not finish');
  }
});
