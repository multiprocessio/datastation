const path = require('path');
const { spawnSync } = require('child_process');
const { CODE_ROOT } = require('../constants');
const { getProjectResultsFile } = require('../store');
const fs = require('fs');
const { file: makeTmpFile } = require('tmp-promise');
const {
  ProjectState,
  ProjectPage,
  ContentTypeInfo,
} = require('../../shared/state');
const { updateProjectHandler, flushUnwritten } = require('../store');
const { makeEvalHandler } = require('./eval');
const { fetchResultsHandler } = require('./columns');

exports.inPath = function (program) {
  const where = process.platform === 'win32' ? 'where' : 'whereis';
  const proc = spawnSync(where, [program]);
  return proc.status === 0;
};

exports.fileIsEmpty = function (fileName) {
  try {
    return fs.readFileSync(fileName).toString().trim() === '';
  } catch (e) {
    if (e.code === 'ENOENT') {
      return true;
    }

    throw e;
  }
};

exports.withSavedPanels = async function (
  panels,
  cb,
  { evalPanels, subprocessName, connectors, servers } = {}
) {
  const tmp = await makeTmpFile({ prefix: 'saved-panel-project-' });

  const project = {
    ...new ProjectState(),
    projectName: tmp.path,
    pages: [
      {
        ...new ProjectPage(),
        panels,
      },
    ],
    servers: servers || [],
    connectors: connectors || [],
  };

  try {
    await updateProjectHandler.handler(project.projectName, project);
    await flushUnwritten();
    expect(exports.fileIsEmpty(project.projectName + '.dsproj')).toBe(false);

    if (evalPanels) {
      console.log('Eval-ing panels');
      for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        if (i > 0) {
          // Make sure previous panel results file is on disk
          expect(
            exports.fileIsEmpty(
              getProjectResultsFile(project.projectName) + panels[i - 1].id
            )
          ).toBe(false);
        }
        // And make sure current panel results file is empty
        expect(
          exports.fileIsEmpty(
            getProjectResultsFile(project.projectName) + panel.id
          )
        ).toBe(true);

        function dispatch(r) {
          if (r.resource === 'getProject') {
            const p = ProjectState.fromJSON(
              JSON.parse(
                fs.readFileSync(project.projectName + '.dsproj').toString()
              ),
              false
            );
            return p;
          }

          if (r.resource === 'fetchResults') {
            return fetchResultsHandler.handler(r.projectId, r.body, dispatch);
          }

          // TODO: support more resources as needed
          throw new Error(
            "Unsupported resource in tests. You'll need to add support for it here."
          );
        }

        panel.resultMeta = await makeEvalHandler(subprocessName).handler(
          project.projectName,
          { panelId: panel.id },
          dispatch
        );

        // Write results back to disk
        await updateProjectHandler.handler(project.projectName, project);
        await flushUnwritten();

        // Make panel results are saved to disk
        expect(
          exports.fileIsEmpty(
            getProjectResultsFile(project.projectName) + panel.id
          )
        ).toBe(false);
      }
    } else {
      console.log('YOU DIDNT ASK ME TO EVAL THESE PANELS SO IM NOT GOING TO!');
    }

    return await cb(project);
  } finally {
    try {
      Promise.all(
        panels.map(({ id }) =>
          fs.unlinkSync(getProjectResultsFile(tmp.path) + id)
        )
      );
      await tmp.cleanup();
    } catch (e) {
      console.error(e);
    }
  }
};

module.exports.replaceBigInt = function (rows) {
  for (const row of rows) {
    for (const [key, val] of Object.entries(row)) {
      if (val instanceof BigInt) {
        row[key] = val.toString();
      }
    }
  }
};

module.exports.translateBaselineForType = function (baseline, fileType) {
  if (fileType === 'json' || fileType === 'jsonl') {
    return baseline;
  }

  const data = [];
  for (const row of baseline) {
    const translatedRow = {};
    Object.keys(row).forEach((k) => {
      // All non-json, non-parquet get the column header trimmed
      const columnHeader = ['json', 'parquet'].includes(fileType)
        ? k
        : k.trim();
      translatedRow[columnHeader] = row[k];

      // CSVs are just strings
      if (fileType === 'csv') {
        translatedRow[columnHeader] = String(row[k]);
      }

      // Parquet dates are in integer format
      if (
        fileType === 'parquet' &&
        String(new Date(row[k])) !== 'Invalid Date'
      ) {
        translatedRow[columnHeader] = new Date(row[k]).valueOf();
      }
    });
    data.push(translatedRow);
  }

  return data;
};

module.exports.REGEXP_TESTS = [
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

module.exports.RUNNERS = [
  undefined,
  { node: path.join(CODE_ROOT, 'build', 'desktop_runner.js') },
  { go: path.join(CODE_ROOT, 'build', 'go_desktop_runner_test') },
].filter(function (r) {
  const runners = ['memory', 'node', 'go'];

  let runner = 'memory';
  if (r) {
    if (r.node) {
      runner = 'node';
    } else {
      runner = 'go';
    }
  }

  let runnerSpecified = undefined;
  for (r of runners) {
    if (process.argv.includes('--dsrunner=' + r)) {
      runnerSpecified = r;
    }
  }

  if (!runnerSpecified) {
    return true;
  }

  return runnerSpecified === runner;
});

module.exports.VERBOSE = process.argv.includes('--dsverbose=true');
