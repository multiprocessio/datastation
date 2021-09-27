const { SYNC_PERIOD } = require('./constants');
const { wait } = require('../shared/promise');
const { deepClone } = require('../shared/object');
const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const { storeHandlers, ensureProjectFile } = require('./store');
const {
  ProjectState,
  Encrypt,
  DatabaseConnectorInfo,
  ServerInfo,
} = require('../shared/state');
const { ensureSigningKey } = require('./secret');

const makeProject = storeHandlers.filter(
  (r) => r.resource === 'makeProject'
)[0];
const getProject = storeHandlers.filter(
  (r) => r.resource === 'getProjectState'
)[0];
const updateProject = storeHandlers.filter(
  (r) => r.resource === 'updateProjectState'
)[0];

test('write project with encrypted secrets, read with nulled secrets', async () => {
  // Shouldn't be harmful even though it is potentially creating a new
  // real file. It's value is valid and wouldn't overwrite an existing
  // one. Just necessary to call so that in tests this is definitely
  // populated.
  await ensureSigningKey();

  const testProject = new ProjectState();
  const testServer = new ServerInfo();
  const testServerPassword = 'taffy';
  testServer.password = new Encrypt(testServerPassword);
  const testServerPassphrase = 'kewl';
  testServer.passphrase = new Encrypt(testServerPassphrase);
  const testDatabase = new DatabaseConnectorInfo();
  const testDatabasePassword = 'kevin';
  testDatabase.database.password = new Encrypt(testDatabasePassword);
  testProject.servers.push(testServer);
  testProject.connectors.push(testDatabase);

  const projectId = 'unittestproject';
  const projectPath = await ensureProjectFile(projectId);
  expect(projectPath).toBe(
    path.join(os.homedir(), 'DataStationProjects', projectId + '.dsproj')
  );

  try {
    await makeProject.handler(null, { projectId });
    await updateProject.handler(projectId, null, testProject);

    // Wait to make sure file has been written
    await wait(SYNC_PERIOD + 1000);

    const f = await fs.readFile(projectPath);
    const onDisk = JSON.parse(f.toString());

    // Passwords are encrypted
    expect(onDisk.servers[0].password.value.length).not.toBe(0);
    expect(onDisk.servers[0].password.value).not.toBe(testServerPassword);
    expect(onDisk.servers[0].password.encrypted).toBe(true);
    expect(onDisk.servers[0].passphrase.value.length).not.toBe(0);
    expect(onDisk.servers[0].passphrase.value).not.toBe(testServerPassphrase);
    expect(onDisk.servers[0].passphrase.encrypted).toBe(true);
    expect(onDisk.connectors[0].database.password.value.length).not.toBe(0);
    expect(onDisk.connectors[0].database.password).not.toBe(
      testDatabasePassword
    );
    expect(onDisk.connectors[0].database.password.encrypted).toBe(true);

    // Passwords come back as null
    const readProject = await getProject.handler(null, projectId);
    testServer.id = onDisk.servers[0].id; // id is generated newly on every instantiation which is ok
    testServer.password.value = null;
    testServer.password.encrypted = true;
    testServer.passphrase.value = null;
    testServer.passphrase.encrypted = true;
    testDatabase.database.password.value = null;
    testDatabase.database.password.encrypted = true;
    testDatabase.id = onDisk.connectors[0].id; // id is generated newly on every instantiation which is ok
    testProject.id = readProject.id; // id is generated newly on every instantiation which is ok
    expect(readProject).toStrictEqual(testProject);
  } finally {
    try {
      await fs.unlink(projectPath);
    } catch (e) {
      console.error(e);
    }
  }
});

test('write project with encrypted secrets, read with nulled secrets', async () => {
  const testProject = new ProjectState();
  testProject.projectName = path.join(os.homedir(), 'unittestproject2.dsproj');

  try {
    await makeProject.handler(null, { projectId: testProject.projectName });
    const read = await getProject.handler(null, testProject.projectName);
    read.id = testProject.id; // id is generated newly on every instantiation which is ok
    expect(read).toStrictEqual(testProject);
  } finally {
    const projectPath = await ensureProjectFile(testProject.projectName);
    try {
      await fs.unlink(projectPath);
    } catch (e) {
      console.error(e);
    }
  }
});
