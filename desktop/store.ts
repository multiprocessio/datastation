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

export function getProjectResultsFile(projectId: string) {
  const fileName = path
    .basename(projectId)
    .replace('.' + PROJECT_EXTENSION, '');
  const base = path.join(DISK_ROOT, '.' + fileName + '.results');
  ensureFile(base);
  return base;
}

function checkAndEncrypt(e: Encrypt, existing?: Encrypt) {
  existing = existing || new Encrypt('');
  const new_ = existing;

  if (e.value !== null && e.value !== undefined) {
    new_.value = e.value;
    new_.encrypted = e.encrypted;

    if (!e.encrypted) {
      new_.value = encrypt(e.value);
      new_.encrypted = true;
    }
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

export const updateProjectHandler: UpdateProjectHandler = {
  resource: 'updateProject',
  handler: async (projectId: string, newState: ProjectState) => {
    const fileName = ensureProjectFile(projectId);
    writeFileBuffered(fileName, JSON.stringify(newState));
  },
};

const makeProjectHandler: MakeProjectHandler = {
  resource: 'makeProject',
  handler: async (_: string, { projectId }: MakeProjectRequest) => {
    const fileName = ensureProjectFile(projectId);
    const newProject = new ProjectState();
    newProject.projectName = fileName;
    const files = fs.readdirSync(path.join(__dirname, 'migrations'));
    files.sort();
    const db = sqlite.open(fileName)
    for (const file of files) {
      log.info('Running migration: ' + file);
      const contents = fs.readFileSync(file).toString();
      await db.exec(contents);
      log.info('Done migration: ' + file);
    }

    await 

    return fs.writeFileSync(fileName, JSON.stringify(newProject));
  },
};

const getPagesHandler: GetPagesHandler = {
  resource: 'getPages',
  handler: async (
    _0: string,
    { projectId }: GetPagesRequest,
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

export const updateProjectHandler: UpdateProjectHandler = {
  resource: 'updateProject',
  handler: async (projectId: string, newState: ProjectState) => {
    const fileName = ensureProjectFile(projectId);
    writeFileBuffered(fileName, JSON.stringify(newState));
  },
};

// Break handlers out so they can be individually typed without `any` <-- huh. is this supposed to be a TODO?
export const storeHandlers: RPCHandler<any, any>[] = [
  getProjectHandler,
  updateProjectHandler,
  makeProjectHandler,
];

export function ensureProjectFile(projectId: string) {
  const ext = '.' + PROJECT_EXTENSION;
  return ensureFile(projectId + (projectId.endsWith(ext) ? '' : ext));
}
