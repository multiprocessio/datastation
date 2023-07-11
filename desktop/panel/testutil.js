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
  LiteralPanelInfo,
  Encrypt,
  DatabasePanelInfo,
  DatabaseConnectorInfo,
} = require('../../shared/state');
const { Store } = require('../store');
const { makeDispatch } = require('../rpc');
const { makeEvalHandler } = require('./eval');
const { fetchResultsHandler } = require('./columns');
const { ensureSigningKey } = require('../secret');

ensureSigningKey();

exports.inPath = function (program) {
  const where = {
    linux: 'which',
    darwin: 'which',
    win32: 'whereis',
  }[process.platform];
  console.log(`Looking up ${program} in path.`);
  const proc = spawnSync(where, [program], { shell: true, stdio: 'inherit' });
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

exports.updateProject = async function (project, opts) {
  let dispatch = opts?.dispatch;
  if (!dispatch) {
    dispatch = makeDispatch(new Store().getHandlers());
  }

  if (opts?.isNew) {
    await dispatch(
      { resource: 'makeProject', body: { projectId: project.projectName } },
      true
    );
  }

  for (let i = 0; i < project.pages.length; i++) {
    const page = project.pages[i];
    // Save before update these get deleted off the object.
    const panels = page.panels;
    await dispatch(
      {
        resource: 'updatePage',
        projectId: project.projectName,
        body: {
          data: page,
          position: i,
          insert: true,
        },
      },
      true
    );
    page.panels = panels;

    for (let j = 0; j < panels.length; j++) {
      panels[j].pageId = page.id;
      await dispatch(
        {
          resource: 'updatePanel',
          projectId: project.projectName,
          body: {
            data: panels[j],
            position: j,
            insert: true,
          },
        },
        true
      );
    }
  }

  for (let i = 0; i < project.servers.length; i++) {
    const server = project.servers[i];
    await dispatch(
      {
        resource: 'updateServer',
        projectId: project.projectName,
        body: {
          data: server,
          position: i,
          insert: true,
        },
      },
      true
    );
  }

  for (let i = 0; i < project.connectors.length; i++) {
    const connector = project.connectors[i];
    await dispatch(
      {
        resource: 'updateConnector',
        projectId: project.projectName,
        body: {
          data: connector,
          position: i,
          insert: true,
        },
      },
      true
    );
  }
};

exports.withSavedPanels = async function (
  panels,
  cb,
  {
    evalPanels,
    subprocessName,
    settings,
    connectors,
    servers,
    store,
    dispatch,
  } = {}
) {
  if (!store) {
    store = new Store();
  }

  const handlers = [...store.getHandlers(), fetchResultsHandler];
  const getProjectHandler = handlers.find((h) => h.resource === 'getProject');
  const updatePanelResultHandler = handlers.find(
    (h) => h.resource === 'updatePanelResult'
  );
  if (!dispatch) {
    dispatch = makeDispatch(handlers);
  }

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
    await exports.updateProject(project, { isNew: true, dispatch });
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

        if (settings) {
          const settingsTmp = await makeTmpFile({ prefix: 'settings-' });
          fs.writeFileSync(settingsTmp.path, JSON.stringify(settings));
          subprocessName.settingsFileOverride = settingsTmp.path;
        }
        const res = await makeEvalHandler(subprocessName).handler(
          project.projectName,
          { panelId: panel.id },
          dispatch
        );
        if (res.exception) {
          // So that callers can get access to project data if needed
          res.exception.project = project;
          res.exception.dispatch = dispatch;
          throw res.exception;
        }

        // Make sure panel results are saved to disk
        expect(
          exports.fileIsEmpty(
            getProjectResultsFile(project.projectName) + panel.id
          )
        ).toBe(false);
      }
    } else {
      console.log('YOU DIDNT ASK ME TO EVAL THESE PANELS SO IM NOT GOING TO!');
    }

    return await cb(project, dispatch);
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

module.exports.basicDatabaseTest = async function (
  t,
  vendorOverride = {},
  subprocess = null
) {
  if (!subprocess) {
    subprocess = module.exports.RUNNERS.filter((r) => r?.go)[0];
  }

  const lp = new LiteralPanelInfo();
  lp.literal.contentTypeInfo = { type: 'application/json' };
  lp.content = JSON.stringify([
    { age: '19', name: 'Kate', location: { city: 'San Juan' } },
    { age: '20', name: 'Bake', location: { city: 'Toronto' } },
  ]);

  const connectors = [
    new DatabaseConnectorInfo({
      type: t.type,
      database: vendorOverride[t.type]?.database || 'test',
      address: vendorOverride[t.type]?.address || 'localhost',
      username: vendorOverride[t.type]?.username || 'test',
      password_encrypt: new Encrypt(vendorOverride[t.type]?.password || 'test'),
      extra: vendorOverride[t.type]?.extra || {},
    }),
  ];
  const dp = new DatabasePanelInfo();
  dp.database.connectorId = connectors[0].id;
  dp.content = t.query;

  let finished = false;
  const panels = [lp, dp];
  await module.exports.withSavedPanels(
    panels,
    async (project) => {
      const panelValueBuffer = fs.readFileSync(
        getProjectResultsFile(project.projectName) + dp.id
      );

      if (t.type == 'odbc' && !t.query.startsWith('SELECT')) {
        finished = true;
        return;
      }

      const v = JSON.parse(panelValueBuffer.toString());
      if (t.query.startsWith('SELECT 1')) {
        expect(v.length).toBe(1);
        // These database drivers are all over the place between Node and Go.
        // Close enough is fine I guess.
        expect(v[0]['1']).toBe(1);
        expect(String(v[0]['2'])).toBe('2.2');
        expect(v[0]['true'] == '1').toBe(true);
        expect(v[0].string).toBe('string');
        expect(new Date(v[0].date)).toStrictEqual(new Date('2021-01-01'));
      } else {
        expect(v).toStrictEqual([
          { name: 'Kate', age: 9, city: 'San Juan' },
          { name: 'Bake', age: 10, city: 'Toronto' },
        ]);
      }
      finished = true;
    },
    { evalPanels: true, connectors, subprocessName: subprocess }
  );

  if (!finished) {
    throw new Error('Callback did not finish');
  }
};
