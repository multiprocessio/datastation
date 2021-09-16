import { IpcMain, IpcMainEvent } from 'electron';
import { RPC_ASYNC_REQUEST, RPC_ASYNC_RESPONSE } from '../shared/constants';
import log from '../shared/log';
import {
  evalColumnsHandler,
  fetchResultsHandler,
  storeLiteralHandler,
} from './eval/columns';
import { evalFileHandler } from './eval/file';
import { evalHTTPHandler } from './eval/http';
import { programHandlers } from './eval/program';
import { evalSQLHandler } from './eval/sql';
import { openProjectHandler } from './project';
import { Settings } from './settings';
import { storeHandlers } from './store';

interface RPCPayload {
  messageNumber: number;
  resource: string;
  projectId: string;
  body: any;
  args: any;
}

export interface RPCHandler {
  resource: string;
  handler: (projectId: string, args: any, body: any) => Promise<any>;
}

export function registerRPCHandlers(
  ipcMain: IpcMain,
  handlers: Array<RPCHandler>
) {
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

        const rsp = await handler.handler(
          payload.projectId,
          payload.args,
          payload.body
        );
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

export const getRPCHandlers = (settings: Settings) =>
  [
    ...storeHandlers,
    evalColumnsHandler,
    storeLiteralHandler,
    evalSQLHandler,
    evalHTTPHandler,
    fetchResultsHandler,
    ...programHandlers,
    evalFileHandler,
    openProjectHandler,
    settings.getUpdateHandler(),
  ] as RPCHandler[];
