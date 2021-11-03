const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const {
  ProjectState,
  PanelResultMeta,
  ProjectPage,
  HTTPPanelInfo,
} = require('../../shared/state');
const { HTTPPanelDetails } = require('./HTTPPanel');

const project = new ProjectState();
project.pages = [new ProjectPage()];
project.pages[0].panels = [new HTTPPanelInfo()];

test('shows file panel details', async () => {
  const component = enzyme.mount(
    <HTTPPanelDetails
      panel={project.pages[0].panels[0]}
      panels={project.pages[0].panels[0]}
      updatePanel={() => {}}
    />
  );
  await componentLoad(component);
});
