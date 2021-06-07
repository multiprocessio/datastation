import { IpcMain, IpcMainEvent } from 'electron';
import fs from 'fs/promises';

import { DEFAULT_PROJECT } from './constants';
import { ProjectState } from './ProjectStore';

export class DesktopStore {
  ipcMain: IpcMain;

  constructor(ipcMain: IpcMain) {
    this.ipcMain = ipcMain;
  }

  register() {
    this.ipcMain.on(
      'updateProjectState',
      async (
        e: IpcMainEvent,
        [projectId, newState]: [e0: string, e1: ProjectState]
      ) => {
        const name = this.getFile(projectId);
        try {
          await fs.writeFile(name, JSON.stringify(newState));
          e.sender.send('updateProjectStateResponse', null);
        } catch (e) {
          console.error(e);
          e.sender.send('updateProjectStateResponse', e);
        }
      }
    );

    this.ipcMain.on(
      'getProjectState',
      async (e: IpcMainEvent, [projectId]: [e0: string]) => {
        const name = this.getFile(projectId);
        const file = await fs.readFile(name);
        e.sender.send('getProjectStateResponse', JSON.parse(file.toString()));
      }
    );
  }

  getFile(projectId: string) {
    return `data/${projectId}.project`;
  }
}
