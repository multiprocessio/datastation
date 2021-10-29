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

test(
  'app loads with default project',
  async () => {
    store.update('test', project);
    window.location.search = '?projectId=test';

    const component = await enzyme.mount(<App />);

    await componentLoad(component);

    await throwOnErrorBoundary(component);

    const panels = await component.find('.view-editor .panel');
    expect(panels.length).toBe(project.pages[0].panels.length);

    // Open all panels
    for (let i = 0; i < panels.length; i++) {
      const p = panels.at(i);
      if (!p.find('.panel-details').length) {
        await p.findWhere(n => n.name() === 'button' && n.prop('data-testid') === 'show-hide-panel').simulate('click');
        await componentLoad(p);
      }

      expect(p.find('.panel-details').length).toBe(1);
    }

    const connectors = await component.find('.connector');
    expect(connectors.length).toBe(project.connectors.length);

    // Open all connectors
    for (let i = 0; i < connectors.length; i++) {
      const c = connectors.at(i);
      await c
        .find({ 'data-testid': 'show-hide-connector', type: 'outline' })
        .simulate('click');
      await componentLoad(c);
    }

    await throwOnErrorBoundary(component);
  },
  10_000 + 1_000 * (project.connectors.length + project.pages[0].panels.length)
);
