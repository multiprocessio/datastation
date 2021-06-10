import { IpcMain, IpcMainEvent } from 'electron';

import { RPC_ASYNC_REQUEST, RPC_ASYNC_RESPONSE } from '../shared/constants';

interface RPCPayload {
  messageNumber: number;
  resource: string;
  body: any;
  args: any;
}

function registerRPCHandlers(ipcMain: IpcMain, handlers: Array<RPCHandler>) {
  ipcMain.on(
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
