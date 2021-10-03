const { spawnSync } = require('child_process');
const path = require('path');
const { getProjectResultsFile } = require('../store');
const { shape } = require('shape');
const { preview } = require('preview');
const fs = require('fs');
const { file: makeTmpFile } = require('tmp-promise');
const {
  ProjectState,
  ProjectPage,
  LiteralPanelInfo,
  ProgramPanelInfo,
} = require('../../shared/state');
const { wait } = require('../../shared/promise');
const { updateProjectHandler } = require('../store');
const { CODE_ROOT } = require('../constants');
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
  { evalPanels, subprocessName } = {}
) {
  const tmp = await makeTmpFile();

  const project = {
    ...new ProjectState(),
    projectName: tmp.path,
    pages: [
      {
        ...new ProjectPage(),
        panels,
      },
    ],
  };

  try {
    await updateProjectHandler.handler(project.projectName, project);

    if (evalPanels) {
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

        await makeEvalHandler(subprocessName).handler(
          project.projectName,
          { panelId: panel.id },
          () => project
        );
      }
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

const LANGUAGES = [
  {
    type: 'javascript',
    content:
      'const prev = DM_getPanel(0); const next = prev.map((row) => ({ ...row, "age": +row.age + 10 })); DM_setPanel(next);',
    condition: true,
  },
  {
    type: 'sql',
    content: 'SELECT name, age::INT + 10 AS age FROM DM_getPanel(0)',
    condition: true,
  },
  // Rest are only mandatory-tested on Linux to make CI easier for now
  {
    type: 'python',
    content:
      'prev = DM_getPanel(0)\nnext = [{ **row, "age": int(row["age"]) + 10 } for row in prev]\nDM_setPanel(next)',
    condition: process.platform === 'linux' || exports.inPath('python3'),
  },
  {
    type: 'ruby',
    content:
      'prev = DM_getPanel(0)\npanel = prev.map { |row| { **row, age: row["age"].to_i + 10 } }\nDM_setPanel(panel)',
    condition: process.platform === 'linux' || exports.inPath('ruby'),
  },
  {
    type: 'julia',
    content:
      'prev = DM_getPanel(0)\nfor row in prev\n  row["age"] = parse(Int64, row["age"]) + 10\nend\nDM_setPanel(prev)',
    condition: process.platform === 'linux' || exports.inPath('julia'),
  },
  {
    type: 'r',
    content:
      'prev = DM_getPanel(0)\nfor (i in 1:length(prev)) {\n  prev[[i]]$age = strtoi(prev[[i]]$age) + 10\n}\nDM_setPanel(prev)',
    condition: process.platform === 'linux' || exports.inPath('Rscript'),
  },
];

for (const t of LANGUAGES) {
  console.log({
    t,
    process.platform,
    exports.inPath(t.type),
  })
  if (!t.condition) {
    continue;
  }

  // First pass runs in process, second pass runs in subprocess
  for (const subprocessName of [
    undefined,
    path.join(CODE_ROOT, 'build', 'desktop_runner.js'),
  ]) {
    test(`runs ${t.type} programs via ${
      subprocessName ? 'process' : subprocessName
    }`, async () => {
      const lp = new LiteralPanelInfo();
      lp.literal.contentTypeInfo = { type: 'text/csv' };
      lp.content = 'age,name\n12,Kev\n18,Nyra';

      const pp = new ProgramPanelInfo();
      pp.program.type = t.type;
      pp.content = t.content;

      let finished = false;
      const panels = [lp, pp];
      await exports.withSavedPanels(
        panels,
        async (project) => {
          const panelValueBuffer = fs.readFileSync(
            getProjectResultsFile(project.projectName) + pp.id
          );
          expect(JSON.parse(panelValueBuffer.toString())).toStrictEqual([
            { name: 'Kev', age: 22 },
            { name: 'Nyra', age: 28 },
          ]);

          finished = true;
        },
        { evalPanels: true, subprocessName }
      );

      if (!finished) {
        throw new Error('Callback did not finish');
      }
    }, 10_000);
  }
}
