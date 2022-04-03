import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { RPC_ASYNC_REQUEST, RPC_ASYNC_RESPONSE } from '../shared/constants';
import log from '../shared/log';
import { Endpoint, IPCRendererResponse, WindowAsyncRPC } from '../shared/rpc';

let messageNumber = -1;

export function bridgeAsyncRPC() {
  const asyncRPC: WindowAsyncRPC = async function <Request, Response = void, EndpointT extends string = Endpoint>(
    resource: EndpointT,
    projectId: string,
    body: Request
  ): Promise<Response> {
    const payload = {
      // Assign a new message number
      messageNumber: ++messageNumber,
      resource,
      body,
      projectId,
    };
    ipcRenderer.send(RPC_ASYNC_REQUEST, payload);

    const result = await new Promise<IPCRendererResponse<Response>>(
      (resolve, reject) => {
	try {
          ipcRenderer.once(
            `${RPC_ASYNC_RESPONSE}:${payload.messageNumber}`,
            (e: IpcRendererEvent, response: IPCRendererResponse<Response>) =>
              resolve(response)
          );
	} catch (e) {
          reject(e);
	}
      }
    );

    if (result.kind === 'error') {
      try {
	throw result.error;
      } catch (e) {
	// The result.error object isn't a real Error at this point with
	// prototype after going through serialization. So throw it to get
	// a real Error instance that has full info for logs.
	log.error(e);
	throw e;
      }
    }

    return result.body;
  };

  contextBridge.exposeInMainWorld('asyncRPC', asyncRPC);
}
