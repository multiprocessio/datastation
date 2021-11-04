const { SYNC_PERIOD } = require('./constants');
const { wait } = require('@datastation/shared/promise');
const { getPath } = require('@datastation/shared/object');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { storeHandlers, ensureProjectFile } = require('./store');
const {
  ProjectState,
  Encrypt,
  DatabaseConnectorInfo,
  ServerInfo,
} = require('@datastation/shared/state');
const { ensureSigningKey } = require('./secret');

const makeProject = storeHandlers.filter(
  (r) => r.resource === 'makeProject'
)[0];
const getProject = storeHandlers.filter((r) => r.resource === 'getProject')[0];
const updateProject = storeHandlers.filter(
  (r) => r.resource === 'updateProject'
)[0];

test('write project with encrypted secrets, read with nulled secrets', async () => {
  // Shouldn't be harmful even though it is potentially creating a new
  // real file. It's value is valid and wouldn't overwrite an existing
  // one. Just necessary to call so that in tests this is definitely
  // populated.
  ensureSigningKey();

  const testProject = new ProjectState();
  const testServer = new ServerInfo();
  const testServerPassword = 'taffy';
  testServer.password_encrypt = new Encrypt(testServerPassword);
  const testServerPassphrase = 'kewl';
  testServer.passphrase_encrypt = new Encrypt(testServerPassphrase);
  const testDatabase = new DatabaseConnectorInfo();
  const testDatabasePassword = 'kevin';
  testDatabase.database.password_encrypt = new Encrypt(testDatabasePassword);
  testProject.servers.push(testServer);
  testProject.connectors.push(testDatabase);

  const projectId = 'unittestproject';
  const projectPath = ensureProjectFile(projectId);
  expect(projectPath).toBe(
    path.join(os.homedir(), 'DataStationProjects', projectId + '.dsproj')
  );

  try {
    await makeProject.handler(null, { projectId });
    await updateProject.handler(projectId, testProject);

    // Wait to make sure file has been written
    await wait(SYNC_PERIOD + 1000);

    const f = fs.readFileSync(projectPath);
    const onDisk = JSON.parse(f.toString());

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

test('write project with encrypted secrets, read with nulled secrets', async () => {
  const testProject = new ProjectState();
  testProject.projectName = path.join(os.homedir(), 'unittestproject2.dsproj');

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
