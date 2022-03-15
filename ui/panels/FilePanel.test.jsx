const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const {
  ProjectState,
  PanelResult,
  ProjectPage,
  FilePanelInfo,
} = require('../../shared/state');
const { FilePanelDetails } = require('./FilePanel');

const project = new ProjectState();
project.pages = [new ProjectPage()];
project.pages[0].panels = [new FilePanelInfo()];

test('shows file panel details', async () => {
  const component = enzyme.mount(
    <FilePanelDetails
      panel={project.pages[0].panels[0]}
      panels={project.pages[0].panels[0]}
      updatePanel={() => {}}
    />
  );
  await componentLoad(component);
});
