import { MODE, SERVER_ROOT } from '../shared/constants';

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

  const rsp = await window.fetch(SERVER_ROOT + `/rpc?resource=${resource}&projectId=${projectId}`, {
    method: 'post',
    contentType: 'application/json',
    body: JSON.stringify({
      args,
      body,
    }),
  });

  const j = await rsp.json();

  if (rsp.status !== 200) {
    throw j;
  }

  return j;
}
