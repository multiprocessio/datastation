import { IpcMain, IpcMainEvent } from 'electron';
import { RPC_ASYNC_REQUEST, RPC_ASYNC_RESPONSE } from '../shared/constants';
import log from '../shared/log';
import {
  DeleteConnectorRequest,
  DeleteConnectorResponse,
  DeletePageRequest,
  DeletePageResponse,
  DeletePanelRequest,
  DeletePanelResponse,
  DeleteServerRequest,
  DeleteServerResponse,
  Endpoint,
  GetProjectRequest,
  GetProjectResponse,
  IPCRendererResponse,
  MakeProjectRequest,
  MakeProjectResponse,
  UpdateConnectorRequest,
  UpdateConnectorResponse,
  UpdatePageRequest,
  UpdatePageResponse,
  UpdatePanelRequest,
  UpdatePanelResponse,
  UpdateServerRequest,
  UpdateServerResponse,
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
export type MakeProjectHandler = RPCHandler<
  MakeProjectRequest,
  MakeProjectResponse
>;
export type UpdateServerHandler = RPCHandler<
  UpdateServerRequest,
  UpdateServerResponse
>;
export type UpdateConnectorHandler = RPCHandler<
  UpdateConnectorRequest,
  UpdateConnectorResponse
>;
export type UpdatePageHandler = RPCHandler<
  UpdatePageRequest,
  UpdatePageResponse
>;
export type UpdatePanelHandler = RPCHandler<
  UpdatePanelRequest,
  UpdatePanelResponse
>;
export type DeleteServerHandler = RPCHandler<
  DeleteServerRequest,
  DeleteServerResponse
>;
export type DeleteConnectorHandler = RPCHandler<
  DeleteConnectorRequest,
  DeleteConnectorResponse
>;
export type DeletePageHandler = RPCHandler<
  DeletePageRequest,
  DeletePageResponse
>;
export type DeletePanelHandler = RPCHandler<
  DeletePanelRequest,
  DeletePanelResponse
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
    if (external) {
      log.info(`Handling request: ${payload.resource}`);
    }
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
            // Not all errors are easily serializable
            stack: e.stack,
            message: e.message,
            name: e.name,
          },
        });
      }
    }
  );
}
