const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const {
  ProjectState,
  PanelResult,
  ProjectPage,
  HTTPPanelInfo,
} = require('../../shared/state');
const { HTTPPanelDetails, HTTPPanelBody } = require('./HTTPPanel');

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

test('shows http panel body', async () => {
  const panel = new HTTPPanelInfo();

  const component = enzyme.mount(
    <HTTPPanelBody
      panel={panel}
      panels={[panel]}
      updatePanel={jest.fn()}
      keyboardShortcuts={jest.fn()}
    />
  );
  await componentLoad(component);
});
