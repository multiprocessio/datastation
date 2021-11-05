const { makeEvalHandler } = require('./eval');
const {
  ProjectState,
  ProjectPage,
  ScheduledExport,
  TablePanelInfo,
  PanelResultMeta,
} = require('@datastation/shared/state');

const project = new ProjectState();
project.pages = [new ProjectPage()];
const lp = new LiteralPanelInfo({
  contentTypeInfo:  { type: 'text/csv' },
  content: 'age,name\n12,Kev\n18,Nyra',
});

const tp = new TablePanelInfo({ panelSource: lp.id })
project.pages[0].panels = [lp, tp];

test('', async () => {
  const { handler } = makeEvalHandler('build/desktop_runner.js');
  // tODO: write to disk and eval
});
