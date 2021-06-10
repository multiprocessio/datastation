import fs from 'fs/promises';

import { ProjectState } from '../shared/state';

export const storeHandlers = [
  {
    resource: 'getProjectState',
    handler: async (projectId: string) => {
      const f = await fs.readFile(getFile(projectId));
      return JSON.parse(f.toString());
    },
  },
  {
    resource: 'updateProjectState',
    handler: (projectId: string, newState: ProjectState) => {
      return fs.writeFile(getFile(projectId), JSON.stringify(newState));
    },
  },
];

function getFile(projectId: string) {
  return `data/${projectId}.project`;
}
