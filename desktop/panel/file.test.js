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
    contentTypeInfo: new ContentTypeInfo('text/nginxaccess'),
    expected: [
      {
        agent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 6_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/6.0 Mobile/10A5376e Safari/8536.25 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        code: '404',
        host: '-',
        http_x_forwarded_for: null,
        method: 'GET',
        path: '/news/53f8d72920ba2744fe873ebc.html',
        referer: '-',
        remote: '63.249.65.4',
        size: '177',
        time: '06/Dev/2021:04:10:38 +0600',
        user: '-',
      },
      {
        agent:
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        code: '200',
        host: '-',
        http_x_forwarded_for: null,
        method: 'GET',
        path: '/path3?ke=y',
        referer: '-',
        remote: '63.202.65.30',
        size: '4223',
        time: '06/Dev/2021:04:11:24 +0600',
        user: '-',
      },
      {
        agent:
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        code: '200',
        host: '-',
        http_x_forwarded_for: null,
        method: 'GET',
        path: '/path2',
        referer: '-',
        remote: '63.200.65.2',
        size: '4356',
        time: '06/Dev/2021:04:12:14 +0600',
        user: '-',
      },
    ],
  },
  {
    filename: 'commonlogformat.log',
    contentTypeInfo: new ContentTypeInfo('text/apache2access'),
    expected: [
      {
        host: '127.0.0.1',
        user: 'frank',
        time: '10/Oct/2000:13:55:36 -0700',
        method: 'GET',
        path: '/apache_pb.gif',
        code: '200',
        size: '2326',
        referer: null,
        agent: null,
      },
      {
        host: '127.0.0.1',
        user: 'mybot',
        time: '10/Oct/2000:13:55:36 -0700',
        method: 'GET',
        path: '/apache_pb.jpg',
        code: '202',
        size: '2326',
        referer: null,
        agent: null,
      },
    ],
  },
  {
    filename: 'apache.error.log',
    contentTypeInfo: new ContentTypeInfo('text/apache2error'),
    expected: [
      {
        time: 'Sep 09 10:42:29.902022 2011',
        level: 'core:error',
        pid: '35708',
        client: '72.15.99.187',
        message: 'File does not exist: /usr/local/apache2/htdocs/favicon.ico',
      },
      {
        time: 'Sep 09 10:42:29.902022 2011',
        level: 'core:error',
        pid: '35708',
        client: '72.15.99.187',
        message: 'File does not exist: /usr/local/apache2/htdocs/favicon.ico',
      },
    ],
  },
  {
    filename: 'custom.log',
    contentTypeInfo: new ContentTypeInfo(
      'text/regexplines',
      '(?<method>[a-zA-Z]+) (?<path>[a-zA-Z/?=0-9]+) (?<domain>[a-zA-Z/?=.]+) (?<address>[0-9.]+)'
    ),
    expected: [
      {
        method: 'GET',
        path: '/path2',
        domain: 'www.google.com',
        address: '8.8.8.10',
      },
      {
        method: 'POST',
        path: '/mypath',
        domain: 'old.misc.org',
        address: '99.10.10.1',
      },
      {
        method: 'DELETE',
        path: '/path?x=y',
        domain: 'nine.org',
        address: '10.0.0.1',
      },
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
