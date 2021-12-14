require('../../shared/polyfill');

const { spawn } = require('child_process');
const { CODE_ROOT } = require('../constants');
const path = require('path');
const fs = require('fs');
const { getProjectResultsFile } = require('../store');
const { HTTPPanelInfo, HTTPConnectorInfo } = require('../../shared/state');
const {
  withSavedPanels,
  translateBaselineForType,
  replaceBigInt,
} = require('./testutil');

const testPath = path.join(CODE_ROOT, 'testdata');
const baseline = JSON.parse(
  fs.readFileSync(path.join(testPath, 'userdata.json').toString())
);

const USERDATA_FILES = ['json', 'xlsx', 'csv', 'parquet', 'jsonl'];

const cp = spawn('python3', ['-m', 'http.server', '9799']);
cp.stdout.on('data', (data) => {
  console.log(data.toString());
});

cp.stderr.on('data', (data) => {
  console.warn(data.toString());
});

for (const subprocessName of [
  undefined,
  { node: path.join(CODE_ROOT, 'build', 'desktop_runner.js') },
  { go: path.join(CODE_ROOT, 'build', 'go_desktop_runner_test') },
]) {
  for (const userdataFileType of USERDATA_FILES) {
    // Parquet over HTTP is broken in the Node runners
    if (userdataFileType === 'parquet' && !subprocessName?.go) {
      continue;
    }

    const hp = new HTTPPanelInfo(
      '',
      new HTTPConnectorInfo(
        '',
        'http://localhost:9799/testdata/userdata.' + userdataFileType
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
              // Grab result
              const value = JSON.parse(
                fs
                  .readFileSync(
                    getProjectResultsFile(project.projectName) + hp.id
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
}

afterAll(() => {
  process.kill(cp.pid);
});
