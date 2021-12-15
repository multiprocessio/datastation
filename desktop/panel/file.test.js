require('../../shared/polyfill');

const { CODE_ROOT } = require('../constants');
const path = require('path');
const fs = require('fs');
const { getProjectResultsFile } = require('../store');
const { FilePanelInfo, ContentTypeInfo } = require('../../shared/state');
const {
  withSavedPanels,
  translateBaselineForType,
  replaceBigInt,
} = require('./testutil');

const USERDATA_FILES = ['json', 'xlsx', 'csv', 'parquet', 'jsonl'];

const testPath = path.join(CODE_ROOT, 'testdata');
const baseline = JSON.parse(
  fs.readFileSync(path.join(testPath, 'userdata.json').toString())
);

const REGEXP_TESTS = [
  {
    filename: 'nginx.access.log',
    contentTypeInfo: new ContentTypeInfo(''),
    expected: [
      { remote: '', host: '', user: '', time: '', method: '', path: '', code: '', size: '', referer: '', agent: '', http_x_forwarded_for: '' },
    ],
  },
  {
    filename: 'syslogrfc3164.log',
    contentTypeInfo: new ContentTypeInfo('text/syslogrfc3164'),
    expected: [
      { pri: '34', time: 'Oct 11 22:14:15', host: 'mymachine', ident: '', pid: '', message: 'failed for lonvick on /dev/pts/9' },
      { pri: '0', time: '1990 Oct 22 10:52:01 TZ-6', host: 'scapegoat.dmz.example.org 10.1.2.3', ident: 'sched', pid: '0', message: 'That\'s All Folks!'}
    ],
  },
  {
    filename: 'syslogrfc5424.log',
    contentTypeInfo: new ContentTypeInfo('text/syslogrfc5424'),
    expected: [
      { pri: '34', time: '2003-10-11T22:14:15.003Z', host: 'mymachine.example.com', ident: 'su', pid: '', msgid: 'ID47', extradata: '', message: 'BOM\'su root\' failed for lonvick on /dev/pts/8' },
      { pri: '165', time: '2003-08-24T05:14:15.003Z', host: 'mymachine.example.com', ident: 'su', pid: '', msgid: 'ID47', extradata: '', message: 'BOM\'su root\' failed for lonvick on /dev/pts/8' },
    ],
  },
  {
    filename: 'apache.access.log',
    contentTypeInfo: new ContentTypeInfo('text/apache2access'),
    expected: [
      { host: '', user: '', time: '', method: '', path: '', code: '', size: '', referer: '', agent: '' }
    ],
  },
  {
    filename: 'apache.error.log',
    contentTypeInfo: new ContentTypeInfo('text/apache2error'),
    expected: [
      { time: '', level: '', pid: '', client: '', message: '' },
    ],
  },
  {
    filename: 'custom.log',
    contentTypeInfo: new ContentTypeInfo('text/regexplines', '(?<method>[a-zA-Z]+) (?<path>[a-zA-Z/?=]+) (?<domain>[a-zA-Z/?=]+) (?<address>[0-9.]+)'),
    expected: [
      { method: 'GET', path: '/path2', domain: 'www.google.com', address: '8.8.8.10' },
      { method: 'POST', path: '/mypath', domain: 'old.misc.org', address: '99.10.10.1' },
      { method: 'DELETE', path: '/path?x=y', domain: 'nine.org', address: '10.0.0.1' },
    ],
  },
];

for (const subprocessName of [
  undefined,
  { node: path.join(CODE_ROOT, 'build', 'desktop_runner.js') },
  { go: path.join(CODE_ROOT, 'build', 'go_desktop_runner_test') },
]) {
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
}
