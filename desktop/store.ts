import AsyncLock from 'async-lock';
import fs from 'fs';
import path from 'path';
import log from '../shared/log';
import { getPath } from '../shared/object';
import { GetProjectRequest, MakeProjectRequest } from '../shared/rpc';
import { doOnEncryptFields, Encrypt, ProjectState } from '../shared/state';
import { DISK_ROOT, PROJECT_EXTENSION, SYNC_PERIOD } from './constants';
import { ensureFile } from './fs';
import {
  GetProjectHandler,
  MakeProjectHandler,
  RPCHandler,
  UpdateProjectHandler,
} from './rpc';
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

export function flushUnwritten() {
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

function checkAndEncrypt(e: Encrypt, existing?: Encrypt) {
  existing = existing || new Encrypt('');
  const new_ = new Encrypt('');
  if (e.value === null) {
    new_.value = existing.value;
    new_.encrypted = true;
  } else if (!e.encrypted) {
    new_.value = encrypt(e.value);
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

const getProjectHandler: GetProjectHandler = {
  resource: 'getProject',
  handler: async (
    _0: string,
    { projectId }: GetProjectRequest,
    _1: unknown,
    external: boolean
  ) => {
    const fileName = ensureProjectFile(projectId);
    try {
      const f = fs.readFileSync(fileName);
      const ps = JSON.parse(f.toString()) as ProjectState;
      return ProjectState.fromJSON(ps, external);
    } catch (e) {
      log.error(e);
      return null;
    }
  },
};

const updateLock = new AsyncLock({ timeout: 10000 });

export const updateProjectHandler: UpdateProjectHandler = {
  resource: 'updateProject',
  handler: async (projectId: string, newState: ProjectState) => {
    const fileName = ensureProjectFile(projectId);
    await updateLock.acquire(fileName, async () => {
      let existingState = new ProjectState();
      try {
        const f = fs.readFileSync(fileName);
        existingState = JSON.parse(f.toString());
      } catch (e) {
        // Fine to default to blank project when reading for update
        if (e.code !== 'ENOENT') {
          throw e;
        }
      }
      encryptProjectSecrets(newState, existingState);
      return writeFileBuffered(fileName, JSON.stringify(newState));
    });
  },
};

const makeProjectHandler: MakeProjectHandler = {
  resource: 'makeProject',
  handler: async (_: string, { projectId }: MakeProjectRequest) => {
    const fileName = ensureProjectFile(projectId);
    const newProject = new ProjectState();
    newProject.projectName = fileName;
    return fs.writeFileSync(fileName, JSON.stringify(newProject));
  },
};

// Break handlers out so they can be individually typed without `any`
export const storeHandlers: RPCHandler<any, any>[] = [
  getProjectHandler,
  updateProjectHandler,
  makeProjectHandler,
];

export function ensureProjectFile(projectId: string) {
  const ext = projectId.split('.').pop();
  if (ext !== projectId && ext && projectId.endsWith(ext)) {
    return ensureFile(projectId);
  }

  return ensureFile(projectId + '.' + PROJECT_EXTENSION);
}
