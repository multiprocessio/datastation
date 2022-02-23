const fs = require('fs');
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
const { App } = require('./app');
const { LocalStorageStore } = require('./ProjectStore');
const { throwOnErrorBoundary } = require('./testutil');

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

    const component = enzyme.mount(<App />);

    await componentLoad(component);

    throwOnErrorBoundary(component);

    let panels = component.find('.view-editor .panel');
    expect(panels.length).toBe(project.pages[0].panels.length);

    // Open all panels
    for (let i = 0; i < panels.length; i++) {
      const p = panels.at(i);
      if (!p.find('.panel-details').length) {
        act(() => {
          p.findWhere(
            (n) =>
              n.name() === 'button' &&
              n.prop('data-testid') === 'show-hide-panel'
          ).simulate('click');
        });
      }
    }

    await componentLoad(component);

    // Look panels up again
    panels = component.find('.view-editor .panel');

    // Check they're all open.
    for (let i = 0; i < panels.length; i++) {
      const p = panels.at(i);
      expect(p.find('.panel-details').length).toBe(1);
    }

    const connectors = component.find('.connector');
    expect(connectors.length).toBe(project.connectors.length);

    // Open all connectors
    for (let i = 0; i < connectors.length; i++) {
      const c = connectors.at(i);
      act(() => {
        c.find({
          'data-testid': 'show-hide-connector',
          icon: true,
        }).simulate('click');
      });
    }

    await componentLoad(component);

    throwOnErrorBoundary(component);
  },
  10_000 + 1_000 * (project.connectors.length + project.pages[0].panels.length)
);
