import { IpcMain, IpcMainEvent } from 'electron';
import { RPC_ASYNC_REQUEST, RPC_ASYNC_RESPONSE } from '../shared/constants';
import log from '../shared/log';

export interface RPCPayload {
  messageNumber: number;
  resource: string;
  projectId: string;
  body: any;
  args: any;
}

export type DispatchPayload = Omit<RPCPayload, 'messageNumber' | 'body'> & {
  body?: any;
};

export type Dispatch = (payload: DispatchPayload) => Promise<any>;

export interface RPCHandler {
  resource: string;
  handler: (
    projectId: string,
    args: any,
    body: any,
    dispatch: Dispatch
  ) => Promise<any>;
}

export function registerRPCHandlers(
  ipcMain: IpcMain,
  handlers: Array<RPCHandler>
) {
  function dispatch(payload: RPCPayload) {
    const handler = handlers.filter((h) => h.resource === payload.resource)[0];
    if (!handler) {
      throw new Error(`No RPC handler for resource: ${payload.resource}`);
    }

    return handler.handler(
      payload.projectId,
      payload.args,
      payload.body,
      dispatch
    );
  }

  ipcMain.on(
    RPC_ASYNC_REQUEST,
    async function (event: IpcMainEvent, payload: RPCPayload) {
      const responseChannel = `${RPC_ASYNC_RESPONSE}:${payload.messageNumber}`;
      try {
        const rsp = await dispatch(payload);
        event.sender.send(responseChannel, {
          body: rsp,
        });
      } catch (e) {
        log.error(e);
        event.sender.send(responseChannel, {
          isError: true,
          body: {
            // Not all fields get pulled out unless explicitly requested
            stack: e.stack,
            message: e.message,
            name: e.name,
          },
        });
      }
    }
  );
}
