if (false) {
  const cp = require('child_process');
  const fs = require('fs');

  const { getProjectResultsFile } = require('../desktop/store');
  const {
    DatabasePanelInfo,
    Encrypt,
    DatabaseConnectorInfo,
  } = require('../shared/state');
  const { withSavedPanels, RUNNERS } = require('../desktop/panel/testutil');
  const { withDocker, DEFAULT_TIMEOUT } = require('./docker');

  function testWithDocker(name, cb) {
    test(
      name,
      async () => {
        if (process.platform !== 'linux') {
          return;
        }

        return withDocker(
          {
            port: 27017,
            image: 'docker.io/library/mongo:5',
            env: {
              MONGO_INITDB_ROOT_USERNAME: 'test',
              MONGO_INITDB_DATABASE: 'test',
              MONGO_INITDB_ROOT_PASSWORD: 'test',
            },
            wait: () => {
              try {
                cp.execSync('mongosh');
              } catch (e) {
                console.error(e);
                throw new Error(
                  `It doesn't seem like mongosh is installed on your machine (or on your $PATH). Download it from here: https://www.mongodb.com/try/download/shell. Or skip this test.`
                );
              }
              const cmds = Array.from(new Array(4)).map(
                (_e, i) =>
                  `mongosh "mongodb://test:test@localhost:27017" --eval "db.test.insertOne($(cat ${
                    __dirname + '/../testdata/documents/' + (i + 1) + '.json'
                  }))"`
              );
              let first = true;
              for (const cmd of cmds) {
                if (first) {
                  while (true) {
                    try {
                      cp.execSync(cmd, { stdio: 'inherit' });
                      break;
                    } catch (e) {
                      /* pass */
                    }
                  }

                  first = false;
                  continue;
                }

                cp.execSync(cmd, { stdio: 'inherit' });
              }
            },
          },
          cb
        );
      },
      DEFAULT_TIMEOUT
    );
  }

  describe('basic mongodb testdata/documents tests', () => {
    testWithDocker('basic test', async () => {
      const connectors = [
        new DatabaseConnectorInfo({
          type: 'mongo',
          database: 'test',
          username: 'test',
          password_encrypt: new Encrypt('test'),
          extra: { authenticationDatabase: 'admin' },
        }),
      ];

      const dp = new DatabasePanelInfo();
      dp.database.connectorId = connectors[0].id;
      dp.content = 'db.test.find({ pageCount: { $gt: 0 } }).toArray()';

      let finished = false;
      const panels = [dp];
      await withSavedPanels(
        panels,
        async (project) => {
          const panelValueBuffer = fs.readFileSync(
            getProjectResultsFile(project.projectName) + dp.id
          );

          const v = Array.from(JSON.parse(panelValueBuffer.toString())).map(
            (el) => {
              delete el._id;
              return el;
            }
          );

          expect(v).toStrictEqual(
            JSON.parse(
              fs.readFileSync('testdata/mongo/documents.json').toString()
            )
          );

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
    });

    testWithDocker('errors with invalid authenticationDatabase', async () => {
      const connectors = [
        new DatabaseConnectorInfo({
          type: 'mongo',
          database: 'test',
          username: 'test',
          password_encrypt: new Encrypt('test'),
          extra: { authenticationDatabase: 'invalid' },
        }),
      ];

      const dp = new DatabasePanelInfo();
      dp.database.connectorId = connectors[0].id;
      dp.content = 'db.test.find({})';

      const panels = [dp];
      try {
        await withSavedPanels(panels, () => {}, {
          evalPanels: true,
          connectors,
          subprocessName: RUNNERS.find((r) => r?.go),
        });
      } catch (e) {
        expect(e.name).toBe('UserError');
        expect(e.message).toBe('MongoServerError: Authentication failed.\n');
      }
    });

    testWithDocker(
      'errors when not using .toArray() on queries returning multiple objects',
      async () => {
        const connectors = [
          new DatabaseConnectorInfo({
            type: 'mongo',
            database: 'test',
            username: 'test',
            password_encrypt: new Encrypt('test'),
          }),
        ];

        const dp = new DatabasePanelInfo();
        dp.database.connectorId = connectors[0].id;
        dp.content = 'db.test.find({ pageCount: { $gt: 0 } })';

        const panels = [dp];
        try {
          await withSavedPanels(panels, () => {}, {
            evalPanels: true,
            connectors,
            subprocessName: RUNNERS.find((r) => r?.go),
          });
        } catch (e) {
          expect(e.name).toBe('UserError');
          expect(
            e.message.startsWith(
              'BSONTypeError: Converting circular structure to EJSON:'
            )
          ).toBe(true);
        }
      }
    );
  });
} else {
  test('ok', function () {});
}
