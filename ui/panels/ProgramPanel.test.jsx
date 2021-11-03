const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const {
  ProjectState,
  PanelResultMeta,
  ProjectPage,
  ProgramPanelInfo,
} = require('../../shared/state');
const { ProgramPanelDetails } = require('./ProgramPanel');

const project = new ProjectState();
project.pages = [new ProjectPage()];
project.pages[0].panels = [new ProgramPanelInfo()];

test('shows program panel details', async () => {
  const component = enzyme.mount(
    <ProgramPanelDetails
      panel={project.pages[0].panels[0]}
      panels={project.pages[0].panels[0]}
      updatePanel={() => {}}
    />
  );
  await componentLoad(component);
});
