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
  const testPanel = new ProgramPanelInfo('python');
  // TODO: make pageId a required parameter;
  testPanel.pageId = testPage.id;
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

  // Delete and recreate it to be safe
  try {
    fs.unlinkSync(projectPath);
  } catch (e) {
    /* nothing */
  }
  ensureProjectFile(projectId);

  try {
    await makeProject.handler(null, { projectId });
    await updateConnector.handler(projectId, {
      data: testDatabase,
      position: 0,
    });
    await updateServer.handler(projectId, {
      data: testServer,
      position: 0,
    });
    await update;
    await updatePanel.handler(projectId, {
      data: testPanel,
      position: 0,
    });

    const onDisk = await getProject.handler(null, { projectId }, null, false);
    console.log(onDisk);

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
    expect(readProject).toStrictEqual(ProjectState.fromJSON(testProject));
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
  testProject.projectName = path.join(os.homedir(), 'unittestproject2.dsproj');

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
    expect(read).toStrictEqual(testProject);
  } finally {
    const projectPath = ensureProjectFile(testProject.projectName);
    try {
      fs.unlinkSync(projectPath);
    } catch (e) {
      console.error(e);
    }
  }
});
