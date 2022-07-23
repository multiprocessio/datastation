const { withDocker } = require('./testutil');

describe('basic cassandra/scylladb tests', () => {
  test(`runs basic cql query`, async () => {
    await withDocker(
      {
        image: 'docker.io/scylladb/scylla:latest',
        port: '9042',
        program: [
          '--smp',
          '1',
          '--authenticator',
          'PasswordAuthenticator',
          '--broadcast-address',
          '127.0.0.1',
          '--listen-address',
          '0.0.0.0',
          '--broadcast-rpc-address',
          '127.0.0.1',
        ],
        cmds: [
          `cqlsh -u cassandra -p cassandra -e "CREATE KEYSPACE test WITH REPLICATION = {'class': 'SimpleStrategy', 'replication_factor': 1};"`,
          `cqlsh -u cassandra -p cassandra -e "CREATE ROLE test WITH PASSWORD = 'test' AND LOGIN = true AND SUPERUSER = true;"`,
        ],
      },
      async () => {
        const connectors = [
          new DatabaseConnectorInfo({
            type: 'scylla',
            database: 'test',
            username: 'cassandra',
            password_encrypt: new Encrypt('cassandra'),
          }),
        ];
        const dp = new DatabasePanelInfo();
        dp.database.connectorId = connectors[0].id;
        dp.content = 'select broadcast_address from system.local;';

        let finished = false;
        const panels = [dp];
        await withSavedPanels(
          panels,
          async (project) => {
            const panelValueBuffer = fs.readFileSync(
              getProjectResultsFile(project.projectName) + dp.id
            );

            const v = JSON.parse(panelValueBuffer.toString());
            expect(v).toStrictEqual([{ broadcast_address: '127.0.0.1' }]);

            finished = true;
          },
          { evalPanels: true, connectors, subprocessName: subprocess }
        );

        if (!finished) {
          throw new Error('Callback did not finish');
        }
      }
    );
  }, 30_000);
});
