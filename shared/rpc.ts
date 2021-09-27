export type EvalBody = string;

export type StoreEndpoint =
  | 'getProjects'
  | 'makeProject'
  | 'updateProject'
  | 'getProject'
  | 'openProject';

export type EvalEndpoint =
  | 'killProcess'
  | 'evalProgram'
  | 'storeLiteral'
  | 'fetchResults'
  | 'evalColumns'
  | 'evalFilterAggregate'
  | 'evalTimeSeries'
  | 'evalFile'
  | 'evalHTTP'
  | 'evalProgram'
  | 'evalSQL';

export type Endpoint = EvalEndpoint | StoreEndpoint;

export type WindowAsyncRPC = <Request, Response = void>(
  resource: Endpoint,
  projectId: string,
  body: Request
) => Promise<Response>;

export type IPCRendererResponse<T> =
  | { kind: 'error'; error: Error }
  | { kind: 'response'; body: T };
