import { IpcMain, IpcMainEvent } from 'electron';
import { RPC_ASYNC_REQUEST, RPC_ASYNC_RESPONSE } from '../shared/constants';
import {
  evalColumnsHandler,
  fetchResultsHandler,
  storeLiteralHandler,
} from './eval/columns';
import { evalFileHandler } from './eval/file';
import { evalHTTPHandler } from './eval/http';
import { programHandlers } from './eval/program';
import { evalSQLHandler } from './eval/sql';
import { configureLogger } from './log';
import { openProjectHandler, openWindow } from './project';
import { loadSettings } from './settings';
import { storeHandlers } from './store';
import log from '../shared/log';

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
            ...e,
            // Needs to get passed explicitly or name comes out as Error after rpc
            message: e.message,
            name: e.name,
          },
        });
      }
    }
  );
}

export const RPC_HANDLERS = [
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
