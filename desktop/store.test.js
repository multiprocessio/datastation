const { wait } = require('../shared/promise');
const { getPath } = require('../shared/object');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { Store, ensureProjectFile } = require('./store');
const {
  ProjectState,
  ProjectPage,
  ProgramPanelInfo,
  Encrypt,
  DatabaseConnectorInfo,
  ServerInfo,
} = require('../shared/state');
const { ensureSigningKey } = require('./secret');

const storeHandlers = new Store().getHandlers();
const makeProject = storeHandlers.filter(
  (r) => r.resource === 'makeProject'
)[0];
const updateConnector = storeHandlers.filter(
  (r) => r.resource === 'updateConnector'
)[0];
const updateServer = storeHandlers.filter(
  (r) => r.resource === 'updateServer'
)[0];
const updatePanel = storeHandlers.filter(
  (r) => r.resource === 'updatePanel'
)[0];
const updatePage = storeHandlers.filter((r) => r.resource === 'updatePage')[0];
const getProject = storeHandlers.filter((r) => r.resource === 'getProject')[0];

test('write project with encrypted secrets, read with nulled secrets', async () => {
  // Shouldn't be harmful even though it is potentially creating a new
  // real file. It's value is valid and wouldn't overwrite an existing
  // one. Just necessary to call so that in tests this is definitely
  // populated.
  ensureSigningKey();

  const testProject = new ProjectState();

  const testPage = new ProjectPage('My test page');
  testProject.pages = [testPage];
  const testPanel = new ProgramPanelInfo(testPage.id, { type: 'python' });
  testPage.panels = [testPanel];

  const testServer = new ServerInfo();
  const testServerPassword = 'taffy';
  testServer.password_encrypt = new Encrypt(testServerPassword);
  const testServerPassphrase = 'kewl';
  testServer.passphrase_encrypt = new Encrypt(testServerPassphrase);
  testProject.servers.push(testServer);

  const testDatabase = new DatabaseConnectorInfo();
  const testDatabasePassword = 'kevin';
  testDatabase.database.password_encrypt = new Encrypt(testDatabasePassword);
  testProject.connectors.push(testDatabase);

  const projectId = 'unittestproject';
  const projectPath = ensureProjectFile(projectId);
  expect(projectPath).toBe(
    path.join(os.homedir(), 'DataStationProjects', projectId + '.dsproj')
  );
  testProject.projectName = projectPath;

  // Delete and recreate it to be safe
  try {
    fs.unlinkSync(projectPath);
  } catch (e) {
    /* nothing */
  }
  ensureProjectFile(projectId);

  try {
    await makeProject.handler(null, { projectId });
    await updateServer.handler(projectId, {
      data: testServer,
      position: 0,
    });
    await updateConnector.handler(projectId, {
      data: testDatabase,
      position: 0,
    });
    await updatePage.handler(projectId, {
      data: testPage,
      position: 0,
    });
    await updatePanel.handler(projectId, {
      data: testPanel,
      position: 0,
    });

    const onDisk = await getProject.handler(null, { projectId }, null, false);

    // Passwords are encrypted
    expect(onDisk.servers[0].password_encrypt.value.length).not.toBe(0);
    expect(onDisk.servers[0].password_encrypt.value).not.toBe(
      testServerPassword
    );
    expect(onDisk.servers[0].password_encrypt.encrypted).toBe(true);
    expect(onDisk.servers[0].passphrase_encrypt.value.length).not.toBe(0);
    expect(onDisk.servers[0].passphrase_encrypt.value).not.toBe(
      testServerPassphrase
    );
    expect(onDisk.servers[0].passphrase_encrypt.encrypted).toBe(true);
    expect(
      onDisk.connectors[0].database.password_encrypt.value.length
    ).not.toBe(0);
    expect(onDisk.connectors[0].database.password_encrypt.value).not.toBe(
      testDatabasePassword
    );
    expect(onDisk.connectors[0].database.password_encrypt.encrypted).toBe(true);

    // Passwords come back as null
    const readProject = await getProject.handler(null, { projectId });
    readProject.id = testProject.id; // id is generated newly on every instantiation which is ok
    // Time objects don't compare well
    readProject.pages[0].panels[0].lastEdited =
      testProject.pages[0].panels[0].lastEdited = null;
    // Super weird but it fails saying "serializes to the same string" even when you use spread operator.
    expect(JSON.stringify(readProject)).toStrictEqual(
      JSON.stringify(ProjectState.fromJSON(testProject))
    );
  } finally {
    try {
      fs.unlinkSync(projectPath);
    } catch (e) {
      console.error(e);
    }
  }
});

test('newly created project is saved correctly', async () => {
  const testProject = new ProjectState();
  testProject.projectName = ensureProjectFile(testProject.id);

  // Delete and recreate it to be safe
  try {
    fs.unlinkSync(testProject.projectName);
  } catch (e) {
    /* nothing */
  }
  ensureProjectFile(testProject.projectName);

  try {
    await makeProject.handler(null, { projectId: testProject.projectName });
    const read = await getProject.handler(null, {
      projectId: testProject.projectName,
    });
    read.id = testProject.id; // id is generated newly on every instantiation which is ok
    // Super weird but it fails saying "serializes to the same string" even when you use spread operator.
    expect(JSON.stringify(read)).toEqual(JSON.stringify(testProject));
  } finally {
    const projectPath = ensureProjectFile(testProject.projectName);
    try {
      fs.unlinkSync(projectPath);
    } catch (e) {
      console.error(e);
    }
  }
});

test('updates works correctly', async () => {
  const testProject = new ProjectState();
  testProject.projectName = ensureProjectFile(testProject.id);

  // Delete and recreate it to be safe
  try {
    fs.unlinkSync(testProject.projectName);
  } catch (e) {
    /* nothing */
  }
  ensureProjectFile(testProject.projectName);

  const testPage = new ProjectPage('My test page');
  testProject.pages = [testPage];
  const testPanel = new ProgramPanelInfo(testPage.id, { type: 'python' });
  testPage.panels = [testPanel];
  const projectId = testProject.projectName;

  const testServer = new ServerInfo();
  const testServerPassword = 'taffy';
  testServer.password_encrypt = new Encrypt(testServerPassword);
  const testServerPassphrase = 'kewl';
  testServer.passphrase_encrypt = new Encrypt(testServerPassphrase);
  testProject.servers.push(testServer);

  const testDatabase = new DatabaseConnectorInfo();
  const testDatabasePassword = 'kevin';
  testDatabase.database.password_encrypt = new Encrypt(testDatabasePassword);
  testProject.connectors.push(testDatabase);

  try {
    await makeProject.handler(null, { projectId });
    // Add the server
    await updateServer.handler(projectId, {
      data: testServer,
      position: 0,
    });
    // Add the database
    await updateConnector.handler(projectId, {
      data: testDatabase,
      position: 0,
    });
    // Add the page
    await updatePage.handler(projectId, {
      data: testPage,
      position: 0,
    });
    // Add the panel
    await updatePanel.handler(projectId, {
      data: testPanel,
      position: 0,
    });

    // Update the panel
    testPanel.content = 'DM_getPanel(1)';
    await updatePanel.handler(projectId, {
      data: testPanel,
      position: 0,
    });

    // Update the page
    testPage.name = 'A better name';
    await updatePage.handler(projectId, {
      data: testPage,
      position: 0,
    });

    // Update the server
    testServer.name = 'A great server';
    await updateServer.handler(projectId, {
      data: testServer,
      position: 0,
    });

    // Update the database
    testDatabase.name = 'A great database';
    await updateConnector.handler(projectId, {
      data: testDatabase,
      position: 0,
    });

    const read = await getProject.handler(null, {
      projectId: testProject.projectName,
    });
    expect(read.pages[0].name).toBe('A better name');
    expect(read.servers[0].name).toBe('A great server');
    expect(read.connectors[0].name).toBe('A great database');
    expect(read.pages[0].panels[0].lastEdited > testPanel.lastEdited);
    read.pages[0].panels[0].lastEdited = testPanel.lastEdited = null;
    expect(read.pages[0].panels[0]).toStrictEqual(testPanel);
  } finally {
    const projectPath = ensureProjectFile(testProject.projectName);
    try {
      fs.unlinkSync(projectPath);
    } catch (e) {
      console.error(e);
    }
  }
});

test('panel reordering works correctly', async () => {
  const testProject = new ProjectState();
  testProject.projectName = ensureProjectFile(testProject.id);

  // Delete and recreate it to be safe
  try {
    fs.unlinkSync(testProject.projectName);
  } catch (e) {
    /* nothing */
  }
  ensureProjectFile(testProject.projectName);

  const testPage = new ProjectPage('My test page');
  testProject.pages = [testPage];
  const testPanel1 = new ProgramPanelInfo(testPage.id, { type: 'python' });
  const testPanel2 = new ProgramPanelInfo(testPage.id, { type: 'javascript' });
  testPage.panels = [testPanel1, testPanel2];

  const projectId = testProject.projectName;

  try {
    await makeProject.handler(null, { projectId });

    // Add the page
    await updatePage.handler(projectId, {
      data: testPage,
      position: 0,
    });
    // Add the panels
    await updatePanel.handler(projectId, {
      data: testPanel1,
      position: 0,
    });
    await updatePanel.handler(projectId, {
      data: testPanel2,
      position: 1,
    });

    // Move 2 to 1
    await updatePanel.handler(projectId, {
      data: testPanel2,
      position: 0,
    });

    const read = await getProject.handler(null, {
      projectId,
    });
    // Don't try to compare lastEdited
    [...read.pages[0].panels, testPanel2, testPanel1].forEach((p) => {
      p.lastEdited = null;
    });
    // Reversed
    expect(read.pages[0].panels).toStrictEqual([testPanel2, testPanel1]);
  } finally {
    const projectPath = ensureProjectFile(testProject.projectName);
    try {
      fs.unlinkSync(projectPath);
    } catch (e) {
      console.error(e);
    }
  }
});

test('panel result updates work correctly', async () => {
  const testProject = new ProjectState();
  testProject.projectName = ensureProjectFile(testProject.id);

  // Delete and recreate it to be safe
  try {
    fs.unlinkSync(testProject.projectName);
  } catch (e) {
    /* nothing */
  }
  ensureProjectFile(testProject.projectName);

  const testPage = new ProjectPage('My test page');
  testProject.pages = [testPage];
  const testPanel = new ProgramPanelInfo(testPage.id, { type: 'python' });
  testPage.panels = [testPanel];

  const projectId = testProject.projectName;

  try {
    await makeProject.handler(null, { projectId });

    // TODO: implement this test
    throw new Error('IMPLEMENT ME');
  } finally {
    const projectPath = ensureProjectFile(testProject.projectName);
    try {
      fs.unlinkSync(projectPath);
    } catch (e) {
      console.error(e);
    }
  }
});
