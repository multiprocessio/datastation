import fs from 'fs/promises';
import path from 'path';

import { ProjectState } from '../shared/state';

import { DISK_ROOT, PROJECT_EXTENSION, RESULTS_FILE } from './constants';

export const storeHandlers = [
  {
    resource: 'getProjectState',
    handler: async (projectId: string) => {
      const fileName = await ensureProjectFile(projectId);
      try {
        const f = await fs.readFile(fileName);
        return JSON.parse(f.toString());
      } catch (e) {
        console.error(e);
        return null;
      }
    },
  },
  {
    resource: 'updateProjectState',
    handler: async (projectId: string, newState: ProjectState) => {
      const fileName = await ensureProjectFile(projectId);
      return fs.writeFile(fileName, JSON.stringify(newState));
    },
  },
  {
    resource: 'storeResults',
    handler: async function (_: string, results: any) {
      if (!results) {
        return;
      }
      const fileName = await ensureFile(RESULTS_FILE);
      return fs.writeFile(fileName, JSON.stringify(results));
    },
  },
];

export function ensureProjectFile(projectId: string) {
  const ext = projectId.split('.').pop();
  if (projectId.endsWith(ext)) {
    return ensureFile(projectId);
  }

  return ensureFile('.' + PROJECT_EXTENSION);
}

export async function ensureFile(f: string) {
  if (path.isAbsolute(f)) {
    return f;
  }
  await fs.mkdir(DISK_ROOT, { recursive: true });
  return path.join(DISK_ROOT, f);
}
