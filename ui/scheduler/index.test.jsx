const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const {
  ProjectState,
  PanelResultMeta,
  ProjectPage,
  TablePanelInfo,
} = require('../../shared/state');
const { SchedulerWithDeps } = require('./index');

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

test('shows a basic schedule page', async () => {
  const component = enzyme.mount(
    <SchedulerWithDeps
      projectState={project}
      setProjectState={() => {}}
      urlState={{ page: 0 }}
      setUrlState={() => {}}
    />
  );
  await componentLoad(component);
  expect(component.find('.panel').length).toBe(1);
});
