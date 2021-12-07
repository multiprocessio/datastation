const { spawnSync } = require('child_process');
const { getProjectResultsFile } = require('../store');
const fs = require('fs');
const { file: makeTmpFile } = require('tmp-promise');
const { ProjectState, ProjectPage } = require('../../shared/state');
const { updateProjectHandler } = require('../store');
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
  fs.writeFileSync(tmp.path, JSON.stringify(project));

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

        function dispatch(r) {
          if (r.resource === 'getProject') {
            return project;
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
