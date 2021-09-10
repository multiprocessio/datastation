import Hapi from '@hapi/hapi';
import { RPCHandler } from '../desktop/rpc';
import log from '../shared/log';

export async function handleRPC(
  r: Hapi.Request,
  h: Hapi.ResponseToolkit,
  rpcHandlers: RPCHandler[]
) {
  const payload = {
    ...r.query,
    ...(r.payload as any),
  };
  console.log(payload);

  try {
    const handler = rpcHandlers.filter(
      (h) => h.resource === payload.resource
    )[0];
    if (!handler) {
      throw new Error(`No RPC handler for resource: ${payload.resource}`);
    }

    // TODO: run these in an external process pool
    const rsp = await handler.handler(
      payload.projectId,
      payload.args,
      payload.body
    );
    return {
      body: rsp,
    };
  } catch (e) {
    log.error(e);
    return h
      .response({
        isError: true,
        body: {
          ...e,
          // Needs to get passed explicitly or name comes out as Error after rpc
          message: e.message,
          name: e.name,
        },
      })
      .code(400);
  }
}
