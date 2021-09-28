import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import log from '../shared/log';
import { getPath } from '../shared/object';
import { doOnEncryptFields, Encrypt, ProjectState } from '../shared/state';
import { DISK_ROOT, PROJECT_EXTENSION, SYNC_PERIOD } from './constants';
import { ensureFile } from './fs';
import { Dispatch } from './rpc';
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
  const new_ = new Encrypt('');
  if (e.value === null) {
    new_.value = existing.value;
    new_.encrypted = true;
  } else if (!e.encrypted) {
    new_.value = await encrypt(e.value);
    new_.encrypted = true;
  }

  return new_;
}

export function encryptProjectSecrets(
  s: ProjectState,
  existingState: ProjectState
) {
  return doOnEncryptFields(s, (field: Encrypt, path: string) => {
    return checkAndEncrypt(field, getPath(existingState, path));
  });
}

export const storeHandlers = [
  {
    resource: 'getProject',
    handler: async (
      _: string,
      { internal, projectId }: { internal?: boolean; projectId: string }
    ) => {
      const fileName = await ensureProjectFile(projectId);
      try {
        const f = await fsPromises.readFile(fileName);
        const ps = JSON.parse(f.toString()) as ProjectState;
        return await ProjectState.fromJSON(ps, internal);
      } catch (e) {
        log.error(e);
        return null;
      }
    },
  },
  {
    resource: 'updateProject',
    handler: async (
      projectId: string,
      newState: ProjectState,
      dispatch: Dispatch
    ) => {
      const fileName = await ensureProjectFile(projectId);
      const f = await fsPromises.readFile(fileName);
      const existingState = JSON.parse(f.toString());
      await encryptProjectSecrets(newState, existingState);
      return writeFileBuffered(fileName, JSON.stringify(newState));
    },
  },
  {
    resource: 'makeProject',
    handler: async (_0: string, { projectId }: { projectId: string }) => {
      const fileName = await ensureProjectFile(projectId);
      const newProject = new ProjectState();
      newProject.projectName = fileName;
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
