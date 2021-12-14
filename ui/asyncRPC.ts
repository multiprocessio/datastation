import { MODE } from '../shared/constants';
import {
  Endpoint,
  PanelBody,
  PanelEndpoint,
  WindowAsyncRPC,
} from '../shared/rpc';
import { PanelResult } from '../shared/state';
import { getUrlState } from './urlState';

export async function asyncRPC<Request = void, Response = void>(
  resource: Endpoint,
  body: Request
): Promise<Response> {
  const { projectId } = getUrlState();

  if (MODE === 'desktop') {
    // this method is exposed by ./desktop/preload.ts in Electron environments
    const arpc = (window as any).asyncRPC as WindowAsyncRPC;
    return arpc(resource, projectId, body);
  }

  const rsp = await window.fetch(
    `/a/rpc?resource=${resource}&projectId=${projectId}`,
    {
      method: 'post',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        body,
      }),
    }
  );

  if (rsp.status === 401) {
    window.location.href = '/a/auth?projectId=' + projectId;
    return null;
  }

  if (rsp.status !== 200) {
    throw await rsp.json();
  }

  return await rsp.json();
}

export function panelRPC(
  endpoint: PanelEndpoint,
  panelId: string
): Promise<PanelResult> {
  return asyncRPC<PanelBody, PanelResult>(endpoint, { panelId });
}
