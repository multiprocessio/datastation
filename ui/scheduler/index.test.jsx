const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const {
  ProjectState,
  PanelResultMeta,
  ProjectPage,
  ScheduledExport,
  TablePanelInfo,
} = require('../../shared/state');
const { SchedulerWithDeps } = require('./index');

const project = new ProjectState();
project.pages = [new ProjectPage('A great page')];
project.pages[0].schedules = [
  new ScheduledExport({
    destination: {
      type: 'email',
      from: 'test@test.com',
      recipients: 'test2@test.com',
      server: 'smtp.test.com',
    },
  }),
];

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
  console.log(component.debug());
  expect(component.find('.panel').length).toBe(1);
});
