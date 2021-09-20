import express from 'express';
import { DispatchPayload, RPCHandler } from '../desktop/rpc';
import log from '../shared/log';

export async function handleRPC(
  req: express.Request,
  rsp: express.Response,
  rpcHandlers: RPCHandler[]
) {
  const payload = {
    ...req.query,
    ...req.body,
  };

  async function dispatch(payload: DispatchPayload) {
    const handler = rpcHandlers.filter(
      (h) => h.resource === payload.resource
    )[0];
    if (!handler) {
      throw new Error(`No RPC handler for resource: ${payload.resource}`);
    }

    // TODO: run these in an external process pool
    return await handler.handler(
      payload.projectId,
      payload.args,
      payload.body,
      dispatch
    );
  }

  try {
    const rpcResponse = await dispatch(payload);
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
