const { spawnSync } = require('child_process');
const { getProjectResultsFile } = require('../store');
const fs = require('fs');
const { file: makeTmpFile } = require('tmp-promise');
const { ProjectState, ProjectPage } = require('../../shared/state');
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
  { evalPanels, subprocessName, connectors } = {}
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
    connectors: connectors || [],
  };

  try {
    await updateProjectHandler.handler(project.projectName, project);
    await flushUnwritten();
    expect(exports.fileIsEmpty(project.projectName + '.dsproj')).toBe(false);

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
