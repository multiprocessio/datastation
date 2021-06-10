import fs from 'fs/promises';

import { ProjectState } from '../shared/state';

export const storeHandlers = [
  {
    resource: 'getProjectState',
    handler: async (projectId: string) => {
      const fileName = await ensureFile(projectId);
      const f = await fs.readFile(fileName);
      return JSON.parse(f.toString());
    },
  },
  {
    resource: 'updateProjectState',
    handler: async (projectId: string, newState: ProjectState) => {
      const fileName = await ensureFile(projectId);
      return fs.writeFile(fileName, JSON.stringify(newState));
    },
  },
];

async function ensureFile(projectId: string) {
  const base = 'data';
  await fs.mkdir(base, { recursive: true });
  return `${base}/${projectId}.project`;
}
