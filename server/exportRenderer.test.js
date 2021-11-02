const {
  ProjectState,
  PanelResultMeta,
  ProjectPage,
  TablePanelInfo,
} = require('../shared/state');
const { renderPage } = require('./exportRenderer');

const project = new ProjectState();
project.pages = [new ProjectPage()];
const tpi = new TablePanelInfo({
  columns: ['name', 'age'],
});
tpi.resultMeta = new PanelResultMeta({
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
  expect(html.count(`className="panel-name"`)).toBe(1);
  expect(html.count('Monroe')).toBe(1);
  expect(html.count('Kerry')).toBe(1);
});
