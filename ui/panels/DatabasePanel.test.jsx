const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const {
  ProjectState,
  PanelResultMeta,
  ProjectPage,
  DatabasePanelInfo,
} = require('@datastation/shared/state');
const { DatabasePanelDetails } = require('./DatabasePanel');

const project = new ProjectState();
project.pages = [new ProjectPage()];
project.pages[0].panels = [new DatabasePanelInfo()];

test('shows database panel info', async () => {
  const component = enzyme.mount(
    <DatabasePanelDetails
      panel={project.pages[0].panels[0]}
      panels={project.pages[0].panels[0]}
      updatePanel={() => {}}
    />
  );
  await componentLoad(component);
});
