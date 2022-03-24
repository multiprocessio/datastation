import { IpcMain, IpcMainEvent } from 'electron';
import { RPC_ASYNC_REQUEST, RPC_ASYNC_RESPONSE } from '../shared/constants';
import log from '../shared/log';
import {
  DeleteConnectorRequest,
  DeleteConnectorResponse,
  DeleteDashboardRequest,
  DeleteDashboardResponse,
  DeleteExportRequest,
  DeleteExportResponse,
  DeletePageRequest,
  DeletePageResponse,
  DeletePanelRequest,
  DeletePanelResponse,
  DeleteServerRequest,
  DeleteServerResponse,
  Endpoint,
  GetConnectorRequest,
  GetConnectorResponse,
  GetDashboardsRequest,
  GetDashboardsResponse,
  GetExportsRequest,
  GetExportsResponse,
  GetPageRequest,
  GetPageResponse,
  GetPanelRequest,
  GetPanelResponse,
  GetProjectRequest,
  GetProjectResponse,
  GetProjectsRequest,
  GetProjectsResponse,
  GetServerRequest,
  GetServerResponse,
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

export interface GenericRPCPayload<EndpointT extends string> {
  messageNumber: number;
  resource: EndpointT;
  projectId: string;
  body: any;
}

export type RPCPayload = GenericRPCPayload<Endpoint>;

export type DispatchPayload<EndpointT extends string> = Omit<
  GenericRPCPayload<EndpointT>,
  'messageNumber' | 'body'
> & {
  body?: any;
};

export type GenericDispatch<EndpointT extends string> = (
  payload: DispatchPayload<EndpointT>,
  external?: boolean
) => Promise<any>;

export type Dispatch = GenericDispatch<Endpoint>;

export interface RPCHandler<
  Request,
  Response,
  EndpointT extends string = Endpoint
> {
  resource: EndpointT;
  handler: (
    projectId: string,
    body: Request,
    dispatch: GenericDispatch<EndpointT>,
    external: boolean
  ) => Promise<Response>;
}

// Standard handlers
export type GetProjectHandler = RPCHandler<
  GetProjectRequest,
  GetProjectResponse
>;
export type GetProjectsHandler = RPCHandler<
  GetProjectsRequest,
  GetProjectsResponse
>;
export type MakeProjectHandler = RPCHandler<
  MakeProjectRequest,
  MakeProjectResponse
>;
export type UpdateServerHandler = RPCHandler<
  UpdateServerRequest,
  UpdateServerResponse
>;
export type GetServerHandler = RPCHandler<GetServerRequest, GetServerResponse>;

export type UpdateConnectorHandler = RPCHandler<
  UpdateConnectorRequest,
  UpdateConnectorResponse
>;

export type GetConnectorHandler = RPCHandler<
  GetConnectorRequest,
  GetConnectorResponse
>;

export type UpdatePageHandler = RPCHandler<
  UpdatePageRequest,
  UpdatePageResponse
>;

export type GetPageHandler = RPCHandler<GetPageRequest, GetPageResponse>;

export type UpdatePanelHandler = RPCHandler<
  UpdatePanelRequest,
  UpdatePanelResponse
>;

export type GetPanelHandler = RPCHandler<GetPanelRequest, GetPanelResponse>;

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
export type GetDashboardsHandler = RPCHandler<
  GetDashboardsRequest,
  GetDashboardsResponse
>;
export type DeleteDashboardHandler = RPCHandler<
  DeleteDashboardRequest,
  DeleteDashboardResponse
>;
export type GetExportsHandler = RPCHandler<
  GetExportsRequest,
  GetExportsResponse
>;
export type DeleteExportHandler = RPCHandler<
  DeleteExportRequest,
  DeleteExportResponse
>;

// Stub to ensure msg is always typed
function sendIPCRendererResponse(
  event: IpcMainEvent,
  channel: string,
  msg: IPCRendererResponse<any>
) {
  event.sender.send(channel, msg);
}

export function makeDispatch<EndpointT extends string>(
  handlers: RPCHandler<any, any, EndpointT>[]
): GenericDispatch<EndpointT> {
  function dispatch(payload: GenericRPCPayload<EndpointT>, external = false) {
    if (external) {
      log.info(`Handling request: ${payload.resource}`);
    }
    const handler = handlers.filter((h) => h.resource === payload.resource)[0];
    if (!handler) {
      throw new Error(`No RPC handler for resource: ${payload.resource}`);
    }

    return handler.handler(payload.projectId, payload.body, dispatch, external);
  }

  return dispatch;
}

export function registerRPCHandlers<EndpointT extends string>(
  ipcMain: IpcMain,
  handlers: RPCHandler<any, any, EndpointT>[],
  dispatch?: GenericDispatch<EndpointT>
) {
  if (!dispatch) {
    dispatch = makeDispatch<EndpointT>(handlers);
  }

  ipcMain.on(
    RPC_ASYNC_REQUEST,
    async function (
      event: IpcMainEvent,
      payload: GenericRPCPayload<EndpointT>
    ) {
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
