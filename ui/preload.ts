import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

import { RPC_ASYNC_REQUEST, RPC_ASYNC_RESPONSE } from './constants';

let messageNumber = -1;

contextBridge.exposeInMainWorld('asyncRpc', function <
  Request,
  Args,
  Response
>(resource: string, args?: Args, body?: Request) {
  const payload = {
    // Assign a new message number
    messageNumber: ++messageNumber,
    resource,
    args,
    body,
  };
  ipcRenderer.send(RPC_ASYNC_REQUEST, payload);

  return new Promise((resolve, reject) => {
    ipcRenderer.once(
      `${RPC_ASYNC_RESPONSE}:${payload.messageNumber}`,
      (e: IpcRendererEvent, response: Response) => resolve(response)
    );
  });
});
