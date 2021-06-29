import fs from 'fs/promises';
import path from 'path';

import { ProjectState } from '../shared/state';
import {
  DISK_ROOT,
  PROJECT_EXTENSION,
  RESULTS_FILE,
} from '../shared/constants';

export const storeHandlers = [
  {
    resource: 'getProjectState',
    handler: async (projectId: string) => {
      const fileName = await ensureFile(projectId + PROJECT_EXTENSION);
      const f = await fs.readFile(fileName);
      return JSON.parse(f.toString());
    },
  },
  {
    resource: 'updateProjectState',
    handler: async (projectId: string, newState: ProjectState) => {
      const fileName = await ensureFile(projectId + PROJECT_EXTENSION);
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

export async function ensureFile(f: string) {
  await fs.mkdir(DISK_ROOT, { recursive: true });
  return path.join(DISK_ROOT, f);
}
