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

  if (rsp.status === 302) {
    window.location.href = rsp.headers.get('Location');
    return {} as Response;
  }

  const j = await rsp.json();

  if (rsp.status !== 200) {
    throw j;
  }

  return j;
}
