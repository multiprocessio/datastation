import { IpcMain, IpcMainEvent } from 'electron';
import { RPC_ASYNC_REQUEST, RPC_ASYNC_RESPONSE } from '../shared/constants';
import log from '../shared/log';
import {
  Endpoint,
  GetProjectRequest,
  GetProjectResponse,
  IPCRendererResponse,
  MakeProjectRequest,
  MakeProjectResponse,
  UpdateProjectRequest,
  UpdateProjectResponse,
} from '../shared/rpc';

export interface RPCPayload {
  messageNumber: number;
  resource: Endpoint;
  projectId: string;
  body: any;
}

export type DispatchPayload = Omit<RPCPayload, 'messageNumber' | 'body'> & {
  body?: any;
};

export type Dispatch = (payload: DispatchPayload) => Promise<any>;

export interface RPCHandler<Request, Response> {
  resource: Endpoint;
  handler: (
    projectId: string,
    body: Request,
    dispatch: Dispatch,
    external: boolean
  ) => Promise<Response>;
}

// Standard handlers
export type GetProjectHandler = RPCHandler<
  GetProjectRequest,
  GetProjectResponse
>;
export type UpdateProjectHandler = RPCHandler<
  UpdateProjectRequest,
  UpdateProjectResponse
>;
export type MakeProjectHandler = RPCHandler<
  MakeProjectRequest,
  MakeProjectResponse
>;

// Stub to ensure msg is always typed
function sendIPCRendererResponse(
  event: IpcMainEvent,
  channel: string,
  msg: IPCRendererResponse<any>
) {
  event.sender.send(channel, msg);
}

export function registerRPCHandlers(
  ipcMain: IpcMain,
  handlers: RPCHandler<any, any>[]
) {
  function dispatch(payload: RPCPayload, external = false) {
    const handler = handlers.filter((h) => h.resource === payload.resource)[0];
    if (!handler) {
      throw new Error(`No RPC handler for resource: ${payload.resource}`);
    }

    return handler.handler(payload.projectId, payload.body, dispatch, external);
  }

  ipcMain.on(
    RPC_ASYNC_REQUEST,
    async function (event: IpcMainEvent, payload: RPCPayload) {
      const responseChannel = `${RPC_ASYNC_RESPONSE}:${payload.messageNumber}`;
      try {
        const rsp = await dispatch(payload, true);
        sendIPCRendererResponse(event, responseChannel, {
          kind: 'response',
          body: rsp,
        });
      } catch (e) {
        log.error(e);
        sendIPCRendererResponse(event, responseChannel, {
          kind: 'error',
          error: {
            // Not all fields get pulled out unless explicitly requested
            ...e,
            stack: e.stack,
            message: e.message,
            name: e.name,
          },
        });
      }
    }
  );
}
