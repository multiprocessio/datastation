require('../../shared/polyfill');

const { CODE_ROOT } = require('../constants');
const path = require('path');
const fs = require('fs');
const { getProjectResultsFile } = require('../store');
const {
  FilePanelInfo,
  ContentTypeInfo,
  ServerInfo,
} = require('../../shared/state');
const {
  withSavedPanels,
  translateBaselineForType,
  replaceBigInt,
  REGEXP_TESTS,
  RUNNERS,
} = require('./testutil');

const USERDATA_FILES = ['json', 'xlsx', 'csv', 'parquet', 'jsonl'];

const testPath = path.join(CODE_ROOT, 'testdata');
const baseline = JSON.parse(
  fs.readFileSync(path.join(testPath, 'userdata.json').toString())
);

for (const subprocessName of RUNNERS) {
  describe(
    'eval generic file via ' +
      (subprocessName ? subprocessName.go || subprocessName.node : 'memory'),
    () => {
      test('correct result', () => {
        const fp = new FilePanelInfo({
          name: path.join(testPath, 'unknown'),
        });

        const panels = [fp];

        return withSavedPanels(
          panels,
          (project) => {
            // Grab result
            const value = JSON.parse(
              fs
                .readFileSync(
                  getProjectResultsFile(project.projectName) + fp.id
                )
                .toString()
            );

            expect(value).toEqual('hey this is unknown');
          },
          { evalPanels: true, subprocessName }
        );
      });
    }
  );

  for (const userdataFileType of USERDATA_FILES) {
    const fp = new FilePanelInfo({
      name: path.join(testPath, 'userdata.' + userdataFileType),
    });

    const panels = [fp];

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
              // Grab result
              const value = JSON.parse(
                fs
                  .readFileSync(
                    getProjectResultsFile(project.projectName) + fp.id
                  )
                  .toString()
              );

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
        }, 10_000);
      }
    );
  }

  for (const t of REGEXP_TESTS) {
    const fp = new FilePanelInfo({
      name: path.join(testPath, 'logs', t.filename),
      contentTypeInfo: t.contentTypeInfo,
    });

    const panels = [fp];

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
                    getProjectResultsFile(project.projectName) + fp.id
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

  if (process.platform === 'linux') {
    describe(
      'eval file over server via ' +
        (subprocessName ? subprocessName.go || subprocessName.node : 'memory'),
      () => {
        test('correct result', () => {
          const server = new ServerInfo({
            address: 'localhost',
            type: 'ssh-agent',
          });
          const fp = new FilePanelInfo({
            name: path.join(testPath, 'unknown'),
          });
          fp.serverId = server.id;

          const servers = [server];
          const panels = [fp];

          return withSavedPanels(
            panels,
            (project) => {
              // Grab result
              const value = JSON.parse(
                fs
                  .readFileSync(
                    getProjectResultsFile(project.projectName) + fp.id
                  )
                  .toString()
              );

              expect(value).toEqual('hey this is unknown');
            },
            { evalPanels: true, subprocessName, servers }
          );
        }, 10_000);
      }
    );
  }
}
