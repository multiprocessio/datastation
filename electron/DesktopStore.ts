import { IpcMain, IpcMainEvent } from 'electron';
import fs from 'fs/promises';

import { RPC_ASYNC_REQUEST, RPC_ASYNC_RESPONSE } from '../shared/constants';
import { ProjectState } from '../shared/store';

interface RPCPayload {
  messageNumber: number;
  resource: string;
  body: any;
  args: any;
}

export class DesktopStore {
  ipcMain: IpcMain;

  constructor(ipcMain: IpcMain) {
    this.ipcMain = ipcMain;
  }

  registerRPCHandlers() {
    const handlers = [
      {
        resource: 'getProjectState',
        handler: async (projectId: string) => {
          const f = await fs.readFile(this.getFile(projectId));
          return JSON.parse(f.toString());
        },
      },
      {
        resource: 'updateProjectState',
        handler: (projectId: string, newState: ProjectState) => {
          return fs.writeFile(
            this.getFile(projectId),
            JSON.stringify(newState)
          );
        },
      },
    ];

    this.ipcMain.on(
      RPC_ASYNC_REQUEST,
      async function (event: IpcMainEvent, payload: RPCPayload) {
        const responseChannel = `${RPC_ASYNC_RESPONSE}:${payload.messageNumber}`;
        try {
          const handler = handlers.filter(
            (h) => h.resource === payload.resource
          )[0];
          if (!handler) {
            throw new Error(`No RPC handler for resource: ${payload.resource}`);
          }

          const rsp = await handler.handler(payload.args, payload.body);
          event.sender.send(responseChannel, {
            body: rsp,
          });
        } catch (e) {
          console.error(e);
          event.sender.send(responseChannel, {
            isError: true,
            body: e,
          });
        }
      }
    );
  }

  getFile(projectId: string) {
    return `data/${projectId}.project`;
  }
}
