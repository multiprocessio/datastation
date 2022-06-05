const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const {
  ProjectState,
  PanelResult,
  ProjectPage,
  DatabaseConnectorInfo,
  DatabasePanelInfo,
} = require('../../shared/state');
const { ProjectContext } = require('../state');
const {
  DatabasePanelDetails,
  DatabasePanelBody,
  DatabaseInfo,
} = require('./DatabasePanel');

test('shows database panel info', async () => {
  const connector = new DatabaseConnectorInfo();
  const connectors = [connector];
  const panel = new DatabasePanelInfo(null, {
    connectorId: connector.id,
  });

  const component = enzyme.mount(
    <ProjectContext.Provider value={{ state: { connectors, servers: [] } }}>
      <DatabasePanelDetails
        panel={panel}
        panels={[panel]}
        updatePanel={() => {}}
      />
    </ProjectContext.Provider>
  );
  await componentLoad(component);
});

for (const vendor of ['postgres', 'mysql', 'sqlite']) {
  const connector = new DatabaseConnectorInfo({
    type: vendor,
  });
  const connectors = [connector];
  const panel = new DatabasePanelInfo(null, {
    connectorId: connector.id,
  });

  test('shows database helper info for ' + vendor, async () => {
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

test('shows database panel body', async () => {
  const connector = new DatabaseConnectorInfo();
  const connectors = [connector];
  const panel = new DatabasePanelInfo(null, {
    connectorId: connector.id,
  });

  const component = enzyme.mount(
    <ProjectContext.Provider value={{ state: { connectors } }}>
      <DatabasePanelBody
        panel={panel}
        panels={[panel]}
        updatePanel={jest.fn()}
        keyboardShortcuts={jest.fn()}
      />
    </ProjectContext.Provider>
  );
  await componentLoad(component);
});
