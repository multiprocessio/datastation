import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

import { BrowserWindow } from 'electron';

import { IDDict, ProjectState } from '../shared/state';
import log from '../shared/log';

import { DISK_ROOT, PROJECT_EXTENSION, SYNC_PERIOD } from './constants';

const buffers: IDDict<{
  contents: string;
  timeout: ReturnType<typeof setTimeout>;
}> = {};
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
    log.info('Wrote ' + name);
    delete buffers[name];
  }, SYNC_PERIOD);
}

function flushUnwritten() {
  Object.keys(buffers).map((fileName: string) => {
    clearTimeout(buffers[fileName].timeout);
    // Must be a synchronous write in this 'exit' context
    // https://nodejs.org/api/process.html#process_event_exit
    fs.writeFileSync(fileName, buffers[fileName].contents);
    log.info('Flushed ' + fileName);
    delete buffers[fileName];
  });
}
// There doesn't seem to be a catchall signal
['exit', 'SIGUSR1', 'SIGUSR2', 'uncaughtException', 'SIGINT'].map((sig) =>
  process.on(sig, flushUnwritten)
);

export const storeHandlers = [
  {
    resource: 'getProjectState',
    handler: async (projectId: string) => {
      const fileName = await ensureProjectFile(projectId);
      try {
        const f = await fsPromises.readFile(fileName);
        return JSON.parse(f.toString());
      } catch (e) {
        log.error(e);
        return null;
      }
    },
  },
  {
    resource: 'updateProjectState',
    handler: async (projectId: string, newState: ProjectState) => {
      const fileName = await ensureProjectFile(projectId);
      return writeFileBuffered(fileName, JSON.stringify(newState));
    },
  },
  {
    resource: 'storeResults',
    handler: async function (_: string, results: any) {
      if (!results) {
        return;
      }
      const resultsFile =
        (BrowserWindow.getFocusedWindow() as any).DS_project + '.results';
      const fileName = await ensureFile(resultsFile);
      // Don't use buffered write
      await fsPromises.writeFile(fileName, JSON.stringify(results));
      log.info('Results synced');
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

export async function ensureFile(f: string) {
  let root = path.isAbsolute(f) ? path.dirname(f) : DISK_ROOT;
  await fsPromises.mkdir(root, { recursive: true });
  return path.isAbsolute(f) ? f : path.join(DISK_ROOT, f);
}
