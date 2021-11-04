import { ProjectState } from '@datastation/shared/state';
export type GetProjectRequest = { projectId: string };
export type GetProjectResponse = ProjectState | null;

export type UpdateProjectRequest = ProjectState;
export type UpdateProjectResponse = void;

export type MakeProjectRequest = { projectId: string };
export type MakeProjectResponse = void;

export type OpenProjectRequest = void;
export type OpenProjectResponse = void;

export type GetProjectsRequest = void;
export type GetProjectsResponse = Array<{ name: string; createdAt: string }>;

export type PanelBody = { panelId: string };

export type StoreEndpoint =
  | 'getProjects'
  | 'makeProject'
  | 'updateProject'
  | 'getProject'
  | 'openProject'
  | 'updateSettings';

export type PanelEndpoint = 'killProcess' | 'fetchResults' | 'eval';

export type Endpoint = PanelEndpoint | StoreEndpoint;

export type WindowAsyncRPC = <Request, Response = void>(
  resource: Endpoint,
  projectId: string,
  body: Request
) => Promise<Response>;

export type IPCRendererResponse<T> =
  | { kind: 'error'; error: Error }
  | { kind: 'response'; body: T };
