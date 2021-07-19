import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

import { RPC_ASYNC_REQUEST, RPC_ASYNC_RESPONSE } from '../shared/constants';
import log from '../shared/log';

let messageNumber = -1;

contextBridge.exposeInMainWorld('asyncRPC', async function <
  Request,
  Args,
  Response
>(resource: string, projectId: string, args?: Args, body?: Request) {
  const payload = {
    // Assign a new message number
    messageNumber: ++messageNumber,
    resource,
    args,
    body,
    projectId,
  };
  ipcRenderer.send(RPC_ASYNC_REQUEST, payload);

  const result = await new Promise<{
    isError: boolean;
    body: Response | string;
  }>((resolve, reject) => {
    ipcRenderer.once(
      `${RPC_ASYNC_RESPONSE}:${payload.messageNumber}`,
      (
        e: IpcRendererEvent,
        response: { isError: boolean; body: Response | string }
      ) => resolve(response)
    );
  });

  if (result.isError) {
    try {
      throw result.body;
    } catch (e) {
      // Want to log it as an error, not just the object result.body
      log.error(e);
      throw e;
    }
  }

  return result.body;
});
