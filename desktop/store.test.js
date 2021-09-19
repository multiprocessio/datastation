const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const { storeHandlers, ensureProjectFile } = require('./store');
const {
  ProjectState,
  SQLConnectorInfo,
  ServerInfo,
} = require('../shared/state');
const { ensureSigningKey } = require('./secret');

test('write project with encrypted secrets, read with nulled secrets', async () => {
  const updateProject = storeHandlers.filter(
    (r) => r.resource === 'updateProjectState'
  )[0];
  const getProject = storeHandlers.filter(
    (r) => r.resource === 'getProjectState'
  )[0];

  // Shouldn't be harmful even though it is potentially creating a new
  // real file. It's value is valid and wouldn't overwrite an existing
  // one. Just necessary to call so that in tests this is definitely
  // populated.
  await ensureSigningKey();

  const testProject = new ProjectState();
  const testServer = new ServerInfo();
  testServer.password = 'taffy';
  testServer.passphrase = 'kewl';
  const testDatabase = new SQLConnectorInfo();
  testDatabase.sql.password = 'kevin';
  testProject.servers.push(testServer);
  testProject.connectors.push(testDatabase);

  const projectId = 'unittestproject';
  const projectPath = await ensureProjectFile(projectId);
  expect(projectPath).toBe(
    path.join(os.homedir(), 'DataStationProjects', projectId + '.dsproj')
  );

  try {
    await updateProject.handler(projectId, null, testProject);

    const onDisk = JSON.parse((await fs.readFile(projectPath)).toString());
    // Passwords are encrypted
    expect(onDisk.servers[0].password.length).not.toBe(0);
    expect(onDisk.servers[0].password).not.toBe(testServer.password);
    expect(onDisk.servers[0].passphrase.length).not.toBe(0);
    expect(onDisk.servers[0].passphrase).not.toBe(testServer.passphrase);
    expect(onDisk.connectors[0].sql.password.length).not.toBe(0);
    expect(onDisk.connectors[0].sql.password).not.toBe(
      testDatabase.sql.password
    );

    // Passwords come back as null
    const readProject = await getProject.handler(null, projectId);
    testServer.id = onDisk.servers[0].id; // id is generated newly on every instantiation which is ok
    testServer.password = null;
    testServer.passphrase = null;
    testDatabase.sql.password = null;
    testDatabase.id = onDisk.connectors[0].id; // id is generated newly on every instantiation which is ok
    testProject.id = readProject.id; // id is generated newly on every instantiation which is ok
    expect(ProjectState.fromJSON(readProject)).toStrictEqual(testProject);
  } finally {
    try {
      await fs.unlink(projectPath);
    } catch (e) {
      console.error(e);
    }
  }
});

test('write project with encrypted secrets, read with nulled secrets', async () => {
  const makeProject = storeHandlers.filter(
    (r) => r.resource === 'makeProject'
  )[0];
  const getProject = storeHandlers.filter(
    (r) => r.resource === 'getProjectState'
  )[0];

  const testProject = new ProjectState();
  testProject.projectName = 'unittestproject2';

  try {
    await makeProject.handler(null, { projectId: testProject.projectName });
    const read = await getProject.handler(null, testProject.projectName);
    read.id = testProject.id; // id is generated newly on every instantiation which is ok
    expect(ProjectState.fromJSON(read)).toStrictEqual(testProject);
  } finally {
    const projectPath = await ensureProjectFile(testProject.projectName);
    try {
      await fs.unlink(projectPath);
    } catch (e) {
      console.error(e);
    }
  }
});
