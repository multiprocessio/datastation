import express from 'express';
import { DispatchPayload, RPCHandler } from '../desktop/rpc';
import log from '../shared/log';

export function makeDispatch<EndpointT extends string>(
  handlers: RPCHandler<any, any, any>[]
) {
  return async function dispatch(
    payload: DispatchPayload<EndpointT>,
    external = false
  ) {
    const handler = handlers.filter((h) => h.resource === payload.resource)[0];
    if (!handler) {
      throw new Error(`No RPC handler for resource: ${payload.resource}`);
    }

    return await handler.handler(
      payload.projectId,
      payload.body,
      dispatch,
      external
    );
  };
}

export async function handleRPC<EndpointT extends string>(
  req: express.Request,
  rsp: express.Response,
  rpcHandlers: RPCHandler<any, any, any>[]
) {
  const payload = {
    ...req.query,
    ...req.body,
  };

  const dispatch = makeDispatch<EndpointT>(rpcHandlers);

  try {
    const rpcResponse = await dispatch(payload, true);
    rsp.json(rpcResponse || { message: 'ok' });
  } catch (e) {
    log.error(e);
    rsp.status(400).json({
      ...e,
      // Needs to get passed explicitly or name comes out as Error after rpc
      message: e.message,
      name: e.name,
    });
  }
}
