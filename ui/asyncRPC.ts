import { MODE } from '../shared/constants';

// Simple stub for TypeScript as prepared by preload.ts.
export async function asyncRPC<Request, Args, Response>(
  resource: string,
  args?: Args,
  body?: Request
): Promise<Response> {
  const arpc = (window as any).asyncRPC as <Request, Args, Response>(
    resource: string,
    projectId: string,
    args?: Args,
    body?: Request
  ) => Promise<Response>;
  const projectId = (window as any).projectId;

  if (MODE === 'desktop') {
    return arpc(resource, projectId, args, body);
  }

  const rsp = await window.fetch(
    `/a/rpc?resource=${resource}&projectId=${projectId}`,
    {
      method: 'post',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        args,
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

export function evalRPC(
  endpoint: string,
  panelId: string
): Promise<PanelResult> {
  return asyncRPC<{ panelId: string }, void, PanelResult>(endpoint, null, {
    panelId,
  });
}
