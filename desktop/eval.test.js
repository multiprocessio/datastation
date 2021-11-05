const fs = require('fs');
const { makeEvalHandler } = require('./eval');
const { CODE_ROOT } = require('./constants');
const { getProjectResultsFile } = require('./store');
const {
  ProjectState,
  ProjectPage,
  ScheduledExport,
  LiteralPanelInfo,
  TablePanelInfo,
  PanelResultMeta,
} = require('@datastation/shared/state');
const { withSavedPanels } = require('@datastation/runner/testutil.js');

const lp = new LiteralPanelInfo({
  contentTypeInfo: { type: 'text/csv' },
  content: 'age,name\n12,Kev\n18,Nyra',
});

const tp = new TablePanelInfo({
  panelSource: lp.id,
  columns: [{ field: 'age', label: 'Age' }],
});

test('', async () => {
  const { handler } = makeEvalHandler(CODE_ROOT + '/build/desktop_runner.js');

  await withSavedPanels([lp, tp], async (project) => {
    await handler(project.projectName, {
      panelId: lp.id,
    });

    await handler(project.projectName, {
      panelId: tp.id,
    });

    const tpValue = JSON.parse(
      fs
        .readFileSync(getProjectResultsFile(project.projectName) + tp.id)
        .toString()
    );
    expect(tpValue).toEqual([{ age: '12' }, { age: '18' }]);
  });
});
