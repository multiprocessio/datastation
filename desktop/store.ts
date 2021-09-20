import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import log from '../shared/log';
import { Encrypt, ProjectState, SQLConnectorInfo } from '../shared/state';
import { DISK_ROOT, PROJECT_EXTENSION, SYNC_PERIOD } from './constants';
import { ensureFile } from './fs';
import { encrypt } from './secret';

const buffers: Record<
  string,
  {
    contents: string;
    timeout: ReturnType<typeof setTimeout>;
  }
> = {};
export function writeFileBuffered(name: string, contents: string) {
  if (buffers[name]) {
    clearTimeout(buffers[name].timeout);
  }
  buffers[name] = {
    contents,
    timeout: null,
  };
  buffers[name].timeout = setTimeout(() => {
    fs.writeFileSync(name, contents);
    delete buffers[name];
  }, SYNC_PERIOD);
}

function flushUnwritten() {
  Object.keys(buffers).map((fileName: string) => {
    clearTimeout(buffers[fileName].timeout);
    // Must be a synchronous write in this 'exit' context
    // https://nodejs.org/api/process.html#process_event_exit
    fs.writeFileSync(fileName, buffers[fileName].contents);
    delete buffers[fileName];
  });
}
// There doesn't seem to be a catchall signal
['exit', 'SIGUSR1', 'SIGUSR2', 'uncaughtException', 'SIGINT'].map((sig) =>
  process.on(sig, flushUnwritten)
);

export function getProjectResultsFile(projectId: string) {
  const fileName = path
    .basename(projectId)
    .replace('.' + PROJECT_EXTENSION, '');
  return path.join(DISK_ROOT, '.' + fileName + '.results');
}

async function checkAndEncrypt(e: Encrypt, existing: Encrypt) {
  if (e.value === null) {
    e.value = existing.value;
    e.encrypted = true;
  } else if (!e.encrypted) {
    e.value = await encrypt(e.value);
    e.encrypted = true;
  }
}

export async function encryptProjectSecrets(
  s: ProjectState,
  existingState: ProjectState
) {
  for (let i = 0; i < s.servers.length; i++) {
    const server = s.servers[i];
    await checkAndEncrypt(
      server.passphrase,
      existingState.servers[i].passphrase
    );
    await checkAndEncrypt(server.password, existingState.servers[i].password);
  }

  for (let i = 0; i < s.connectors.length; i++) {
    if (conn.type === 'sql') {
      const sconn = conn as SQLConnectorInfo;
      const existingSConn = existingState.connectors[i] as SQLConnectorInfo;
      await checkAndEncrypt(sconn.sql.password, existingSConn.sql.password);
    }
  }
}

export const storeHandlers = [
  {
    resource: 'getProjectState',
    handler: async (_: string, projectId: string) => {
      const fileName = await ensureProjectFile(projectId);
      try {
        const f = await fsPromises.readFile(fileName);
        return ProjectState.fromJSON(JSON.parse(f.toString()));
      } catch (e) {
        log.error(e);
        return null;
      }
    },
  },
  {
    resource: 'updateProjectState',
    handler: async (
      projectId: string,
      _: string,
      newState: ProjectState,
      dispatch: Dispatch
    ) => {
      const existingState = (await dispatch({
        resource: 'getProjectState',
        projectId,
        args: projectId,
      })) as ProjectState;
      await encryptProjectSecrets(newState, existingState);
      const fileName = await ensureProjectFile(projectId);
      return writeFileBuffered(fileName, JSON.stringify(newState));
    },
  },
  {
    resource: 'makeProject',
    handler: async (
      _0: string,
      { projectId }: { projectId: string },
      _1: void
    ) => {
      const fileName = await ensureProjectFile(projectId);
      const newProject = new ProjectState();
      newProject.projectName = projectId;
      return fsPromises.writeFile(fileName, JSON.stringify(newProject));
    },
  },
];

export function ensureProjectFile(projectId: string) {
  const ext = projectId.split('.').pop();
  if (ext !== projectId && ext && projectId.endsWith(ext)) {
    return ensureFile(projectId);
  }

  return ensureFile(projectId + '.' + PROJECT_EXTENSION);
}
