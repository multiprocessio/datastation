const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const {
  ProjectState,
  PanelResult,
  ProjectPage,
  ProgramPanelInfo,
} = require('../../shared/state');
const {
  ProgramPanelDetails,
  ProgramInfo,
  ProgramPanelBody,
} = require('./ProgramPanel');

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

test('shows generic program panel info', async () => {
  const panel = new ProgramPanelInfo();
  const component = enzyme.mount(<ProgramInfo panel={panel} />);
  await componentLoad(component);
  expect(component.text().includes('DM_setPanel(')).toBe(true);
});

test('shows sql-specific program panel info', async () => {
  const panel = new ProgramPanelInfo(null, {
    type: 'sql',
  });
  const component = enzyme.mount(<ProgramInfo panel={panel} />);
  await componentLoad(component);
  expect(component.text().includes('SQL')).toBe(true);
});

test('shows program panel body', async () => {
  const panel = new ProgramPanelInfo();

  const component = enzyme.mount(
    <ProgramPanelBody
      panel={panel}
      panels={[panel]}
      updatePanel={jest.fn()}
      keyboardShortcuts={jest.fn()}
    />
  );
  await componentLoad(component);
});
