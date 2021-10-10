const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const { VENDORS } = require('./connectors');
const {
  ProjectState,
  ProjectPage,
  DatabaseConnectorInfo,
  ServerInfo,
  TablePanelInfo,
  HTTPPanelInfo,
  GraphPanelInfo,
  ProgramPanelInfo,
  LiteralPanelInfo,
  DatabasePanelInfo,
  FilePanelInfo,
  FilterAggregatePanelInfo,
} = require('../shared/state');
const { wait } = require('../shared/promise');
const { App } = require('./app');
const { LocalStorageStore } = require('./ProjectStore');

async function throwOnErrorBoundary(component) {
  component.find('ErrorBoundary').forEach((e) => {
    if (e.find({ type: 'fatal' }).length) {
      // Weird ways to find the actual error message
      throw new Error(e.find('Highlight').props().children);
    }
  });
}

async function componentLoad(component) {
  await wait(1000);
  await act(async () => {
    await wait(0);
    component.update();
  });
}

test('app loads with default project', async () => {
  const store = new LocalStorageStore();
  const project = new ProjectState();
  project.pages = [new ProjectPage()];
  project.connectors = Object.keys(VENDORS)
    .sort()
    .map((id) => new DatabaseConnectorInfo({ type: id }));
  project.pages[0].panels = [
    new TablePanelInfo(),
    new HTTPPanelInfo(),
    new GraphPanelInfo(),
    new ProgramPanelInfo(),
    new LiteralPanelInfo(),
    ...project.connectors.map(
      (c) => new DatabasePanelInfo({ connectorId: c.id })
    ),
    new FilePanelInfo(),
    new FilterAggregatePanelInfo(),
  ];
  project.servers = [new ServerInfo()];

  store.update('test', project);
  window.location.search = '?project=test';

  const component = await enzyme.mount(<App />);

  await componentLoad(component);

  const panels = await component.find('.panel');
  expect(panels.length).toBe(project.pages[0].panels.length);

  await throwOnErrorBoundary(component);

  await Promise.all(
    panels.map(async (p) => {
      if (!p.find('.panel-details').length) {
        await p
          .find({ 'data-testid': 'show-hide-details' })
          .props()
          .simulate('click');
        await componentLoad(p);
      }

      expect(p.find('.panel-details').length).toBe(1);
    })
  );

  await throwOnErrorBoundary(component);
}, 10_000);
