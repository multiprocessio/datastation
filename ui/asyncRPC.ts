// Simple stub for TypeScript as prepared by preload.ts.
export const asyncRPC = (window as any).asyncRPC as <Request, Args, Response>(
  resource: string,
  args?: Args,
  body?: Request
) => Promise<Response>;
