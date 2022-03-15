const {
  ProjectState,
  PanelResult,
  ProjectPage,
  TablePanelInfo,
} = require('../shared/state');
const { renderPage } = require('./exportRenderer');

const project = new ProjectState();
project.pages = [new ProjectPage()];
const tpi = new TablePanelInfo({
  columns: ['name', 'age'],
});
tpi.resultMeta = new PanelResult({
  value: [
    { name: 'Kerry', age: 44 },
    { name: 'Monroe', age: 59 },
  ],
  lastRun: new Date(),
});
project.pages[0].panels = [tpi];

test('renders the project', () => {
  const html = renderPage(project, project.pages[0].id).replace('\n', '');
  expect(html.includes('<style type="text/css">')).toBe(true);
  // Only the table gets rendered
  expect(html.split(`className="panel-name"`).length).toBe(1);
  expect(html.split('Monroe').length).toBe(1);
  expect(html.split('Kerry').length).toBe(1);
});
