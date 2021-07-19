// Simple stub for TypeScript as prepared by preload.ts.
export function asyncRPC<Request, Args, Response>(
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

  return arpc(resource, projectId, args, body);
}
