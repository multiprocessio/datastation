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
const { MODE_FEATURES } = require('../../shared/constants');
const { Scheduler } = require('./index');

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
    <Scheduler
      modeFeatures={{ scheduledExports: true }}
      page={project.pages[0]}
      updatePage={() => {}}
    />
  );
  await componentLoad(component);
  expect(component.find('.panel').length).toBe(1);
});

test('shows nothing if not enabled', async () => {
  const component = enzyme.mount(
    <Scheduler
      modeFeatures={{ scheduledExports: false }}
      page={project.pages[0]}
      updatePage={() => {}}
    />
  );
  await componentLoad(component);
  expect(component.find('.panel').length).toBe(0);
  expect(
    component.debug().includes('This feature is only available in server mode.')
  ).toBe(true);
});
