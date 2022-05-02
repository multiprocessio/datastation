const { getProjectResultsFile } = require('../store');
const { shape } = require('shape');
const { preview } = require('preview');
const fs = require('fs');
const { file: makeTmpFile } = require('tmp-promise');
const {
  ProjectState,
  ProjectPage,
  LiteralPanelInfo,
  TablePanelInfo,
} = require('../../shared/state');
const { makeEvalHandler } = require('./eval');
const { fetchResultsHandler } = require('./columns');
const { RUNNERS, withSavedPanels } = require('./testutil');

for (const runner of RUNNERS) {
  if (!runner?.go) {
    continue; // Otherwise not implemented
  }

  test('store and retrieve literal', async () => {
    const testData = [
      { a: 1, b: 'hey' },
      { a: 19, b: 'no no' },
    ];
    const lp = new LiteralPanelInfo(null, {
      contentTypeInfo: { type: 'application/json' },
      content: JSON.stringify(testData),
      name: 'Raw Data',
    });

    const tp = new TablePanelInfo(null, {
      columns: [{ field: 'a' }],
      panelSource: lp.id,
      name: 'Table',
    });

    let finished = false;
    const panels = [lp, tp];
    await withSavedPanels(
      panels,
      async (project, dispatch) => {
        const result = await makeEvalHandler(runner).handler(
          project.projectName,
          { panelId: lp.id },
          dispatch
        );

        const { value: valueFromDisk } = await fetchResultsHandler.handler(
          project.projectName,
          {
            panelId: lp.id,
          },
          dispatch
        );
        expect(valueFromDisk).toStrictEqual(testData);

        expect(result.size).toStrictEqual(JSON.stringify(testData).length);
        expect(result.shape).toStrictEqual(shape(testData));
        expect(result.preview).toStrictEqual(preview(testData));
        expect(result.contentType).toBe('application/json');

        const p = await makeEvalHandler(runner).handler(
          project.projectName,
          { panelId: tp.id },
          dispatch
        );
        const { value: selectColumns } = p;
        expect(selectColumns).toStrictEqual([{ a: 1 }, { a: 19 }]);

        finished = true;
      },
      { evalPanels: false, subprocessName: runner }
    );

    if (!finished) {
      throw new Error('Callback did not finish');
    }
  });
}
