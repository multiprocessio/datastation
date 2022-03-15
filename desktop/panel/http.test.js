require('../../shared/polyfill');

const { ensureSigningKey } = require('../secret');
const { spawn } = require('child_process');
const { CODE_ROOT } = require('../constants');
const fetch = require('node-fetch');
const path = require('path');
const cp = require('child_process');
const os = require('os');
const fs = require('fs');
const { getProjectResultsFile } = require('../store');
const {
  HTTPPanelInfo,
  LiteralPanelInfo,
  HTTPConnectorInfo,
  ServerInfo,
} = require('../../shared/state');
const {
  withSavedPanels,
  translateBaselineForType,
  replaceBigInt,
  REGEXP_TESTS,
  RUNNERS,
} = require('./testutil');

ensureSigningKey();

const testPath = path.join(CODE_ROOT, 'testdata/allformats');
const baseline = JSON.parse(
  fs.readFileSync(path.join(testPath, 'userdata.json').toString())
);

const USERDATA_FILES = ['json', 'xlsx', 'csv', 'parquet', 'jsonl', 'cjson'];
const PORT = '9799';
const PORT2 = '9798';

let server, server2;
// Kill the existing server if it wasn't killed correctly already.
beforeAll(async () => {
  // TODO: port this logic to other platforms...
  for (const port of [PORT, PORT2]) {
    if (process.platform === 'linux') {
      try {
        cp.execSync(
          `bash -c "ps aux | grep 'http.server ${port}' | grep -v grep | awk '{print \\$2}' | xargs -I {} kill {}"`
        );
      } catch (e) {
        console.error(e);
      }
    }
  }

  // Start a new server for all tests
  server = spawn('python3', ['-m', 'http.server', PORT]);
  server2 = spawn('httpmirror', [PORT2]);

  [server, server2].forEach((server) => {
    server.stdout.on('data', (data) => {
      console.log(data.toString());
    });

    server.stderr.on('data', (data) => {
      console.warn(data.toString());
    });
  });

  // Keep trying to connect to the server until it's ready
  return new Promise(async (resolve, reject) => {
    while (true) {
      try {
        await fetch('http://localhost:' + PORT);
        resolve();
        return;
      } catch (e) {
        console.log(e);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });
});

for (const subprocessName of RUNNERS) {
  if (!subprocessName?.go) {
    continue; // Otherwise not implemented
  }

  describe(
    'eval generic file via ' +
      (subprocessName ? subprocessName.go || subprocessName.node : 'memory'),
    () => {
      test('correct result', () => {
        const hp = new HTTPPanelInfo(
          '',
          new HTTPConnectorInfo(
            '',
            'http://localhost:9799/testdata/allformats/unknown'
          )
        );

        const panels = [hp];

        return withSavedPanels(
          panels,
          (project) => {
            // Grab result
            const value = JSON.parse(
              fs
                .readFileSync(
                  getProjectResultsFile(project.projectName) + hp.id
                )
                .toString()
            );

            expect(value).toEqual('hey this is unknown');
          },
          { evalPanels: true, subprocessName }
        );
      }, 30_000);
    }
  );

  for (const userdataFileType of USERDATA_FILES) {
    // Parquet over HTTP is broken in the Node runners
    if (userdataFileType === 'parquet' && !subprocessName?.go) {
      continue;
    }

    const hp = new HTTPPanelInfo(
      '',
      new HTTPConnectorInfo(
        '',
        'http://localhost:9799/testdata/allformats/userdata.' + userdataFileType
      )
    );

    const panels = [hp];

    describe(
      'eval ' +
        userdataFileType +
        ' file via ' +
        (subprocessName ? subprocessName.go || subprocessName.node : 'memory'),
      () => {
        test('correct result', () => {
          return withSavedPanels(
            panels,
            (project) => {
              const v = fs
                .readFileSync(
                  getProjectResultsFile(project.projectName) + hp.id
                )
                .toString();
              // Grab result
              const value = JSON.parse(v);

              const typeBaseline = translateBaselineForType(
                baseline,
                userdataFileType
              );

              // Parquet results seem to come out unsorted
              if (userdataFileType === 'parquet') {
                value.sort((r) => r.Street);
                typeBaseline.sort((r) => r.Street);
              }
              expect(replaceBigInt(value)).toStrictEqual(
                replaceBigInt(typeBaseline)
              );
            },
            { evalPanels: true, subprocessName }
          );
        }, 30_000);
      }
    );
  }

  for (const t of REGEXP_TESTS) {
    const hp = new HTTPPanelInfo(
      '',
      new HTTPConnectorInfo(
        '',
        'http://localhost:9799/testdata/logs/' + t.filename
      )
    );
    hp.http.http.contentTypeInfo = t.contentTypeInfo;

    const panels = [hp];

    describe(
      'read ' +
        t.filename +
        ' file from disk via ' +
        (subprocessName ? subprocessName.go || subprocessName.node : 'memory'),
      () => {
        test('correct result', () => {
          return withSavedPanels(
            panels,
            (project) => {
              // Grab result
              const value = JSON.parse(
                fs
                  .readFileSync(
                    getProjectResultsFile(project.projectName) + hp.id
                  )
                  .toString()
              );

              expect(value).toStrictEqual(t.expected);
            },
            { evalPanels: true, subprocessName }
          );
        }, 10_000);
      }
    );
  }

  describe('http with headers', () => {
    test('correct result', () => {
      const hp = new HTTPPanelInfo(
        '',
        new HTTPConnectorInfo(
          '',
          'http://localhost:9799/testdata/allformats/unknown',
          [{ name: 'X-Test', value: 'OK' }]
        )
      );

      const panels = [hp];

      return withSavedPanels(
        panels,
        (project) => {
          // Grab result
          const value = JSON.parse(
            fs
              .readFileSync(getProjectResultsFile(project.projectName) + hp.id)
              .toString()
          );

          expect(value).toEqual('hey this is unknown');
        },
        { evalPanels: true, subprocessName }
      );
    });
  });

  describe('http with macro', () => {
    test('macro as url', () => {
      const lp = new LiteralPanelInfo(null, {
        contentTypeInfo: { type: 'text/plain' },
        content: '/testdata/allformats/unknown',
        name: 'Raw Data',
      });

      const hp = new HTTPPanelInfo(
        '',
        new HTTPConnectorInfo('', 'http://localhost:9799{{DM_getPanel("0")}}')
      );

      const panels = [lp, hp];

      return withSavedPanels(
        panels,
        (project) => {
          // Grab result
          const value = JSON.parse(
            fs
              .readFileSync(getProjectResultsFile(project.projectName) + hp.id)
              .toString()
          );

          expect(value).toEqual('hey this is unknown');
        },
        { evalPanels: true, subprocessName }
      );
    });

    test('macro as body', () => {
      const lp = new LiteralPanelInfo(null, {
        contentTypeInfo: { type: 'application/json' },
        content: '[{"name": "jim", "age": 12}]',
        name: 'Raw Data',
      });

      const hp = new HTTPPanelInfo(
        '',
        new HTTPConnectorInfo('', 'http://localhost:9798')
      );
      hp.http.http.method = 'POST';
      hp.content = '{{ DM_getPanel("0") | json }}';
      hp.http.http.contentTypeInfo.type = 'text/plain';

      const panels = [lp, hp];

      return withSavedPanels(
        panels,
        (project) => {
          // Grab result
          const value = JSON.parse(
            fs
              .readFileSync(getProjectResultsFile(project.projectName) + hp.id)
              .toString()
          );
          expect([{ name: 'jim', age: 12 }]).toStrictEqual(
            JSON.parse(value.split('\r\n\r\n')[1])
          );
        },
        { evalPanels: true, subprocessName }
      );
    });
  });

  if (process.platform === 'linux') {
    describe('eval http over server via ' + subprocessName.go, () => {
      test('correct result', () => {
        const server = new ServerInfo({
          address: 'localhost',
          type: 'private-key',
        });
        const hp = new HTTPPanelInfo(
          '',
          new HTTPConnectorInfo(
            '',
            'http://localhost:9799/testdata/allformats/unknown'
          )
        );
        hp.serverId = server.id;

        const servers = [server];
        const panels = [hp];

        return withSavedPanels(
          panels,
          (project) => {
            // Grab result
            const value = JSON.parse(
              fs
                .readFileSync(
                  getProjectResultsFile(project.projectName) + hp.id
                )
                .toString()
            );

            expect(value).toEqual('hey this is unknown');
          },
          { evalPanels: true, subprocessName, servers }
        );
      }, 30_000);
    });
  }
}

afterAll(() => {
  process.kill(server.pid);
  process.kill(server2.pid);
});
