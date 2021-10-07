const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
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

test('app loads with default project', async () => {
  const store = new LocalStorageStore();
  const project = new ProjectState();
  project.pages = [new ProjectPage()];
  project.pages[0].panels = [
    new TablePanelInfo(),
    new HTTPPanelInfo(),
    new GraphPanelInfo(),
    new ProgramPanelInfo(),
    new LiteralPanelInfo(),
    new DatabasePanelInfo(),
    new FilePanelInfo(),
    new FilterAggregatePanelInfo(),
  ];
  project.servers = [new ServerInfo()];
  project.connectors = [
    new DatabaseConnectorInfo({ type: 'postgres' }),
    new DatabaseConnectorInfo({ type: 'mysql' }),
    new DatabaseConnectorInfo({ type: 'sqlite' }),
    new DatabaseConnectorInfo({ type: 'oracle' }),
    new DatabaseConnectorInfo({ type: 'sqlserver' }),
    new DatabaseConnectorInfo({ type: 'presto' }),
    new DatabaseConnectorInfo({ type: 'clickhouse' }),
    new DatabaseConnectorInfo({ type: 'snowflake' }),
    new DatabaseConnectorInfo({ type: 'cassandra' }),
    new DatabaseConnectorInfo({ type: 'elasticsearch' }),
    new DatabaseConnectorInfo({ type: 'prometheus' }),
    new DatabaseConnectorInfo({ type: 'influx' }),
  ];

  store.update('test', project);
  window.location.search = '?project=test';

  const component = await enzyme.mount(<App />);

  // Let it load
  await wait(1000);
  await act(async () => {
    await wait(0);
    component.update();
  });

  const panels = await component.find('.panel');
  expect(panels.length).toBe(project.pages[0].panels.length);
}, 10_000);
