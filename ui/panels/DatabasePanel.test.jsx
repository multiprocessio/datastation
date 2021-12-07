const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const {
  ProjectState,
  PanelResultMeta,
  ProjectPage,
  DatabaseConnectorInfo,
  DatabasePanelInfo,
} = require('../../shared/state');
const { ProjectContext } = require('../ProjectStore');
const { DatabasePanelDetails, DatabaseInfo } = require('./DatabasePanel');

test('shows database panel info', async () => {
  const panel = new DatabasePanelInfo();
  const component = enzyme.mount(
    <DatabasePanelDetails
      panel={panel}
      panels={[panel]}
      updatePanel={() => {}}
    />
  );
  await componentLoad(component);
});

for (const vendor of ['postgres', 'mysql', 'sqlite']) {
  const connector = new DatabaseConnectorInfo({
    type: vendor,
  });
  const connectors = [connector];
  const panel = new DatabasePanelInfo({
    connectorId: connector.id,
  });

  test('shows database helper info', async () => {
    const component = enzyme.mount(
      <ProjectContext.Provider value={{ state: { connectors } }}>
        <DatabaseInfo panel={panel} />
      </ProjectContext.Provider>
    );
    await componentLoad(component);

    expect(component.html().includes('to refer to it again. Read more')).toBe(
      true
    );
  });
}
