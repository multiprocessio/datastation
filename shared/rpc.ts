import { Settings } from './settings';
import {
  ConnectorInfo,
  PanelInfo,
  ProjectPage,
  ProjectState,
  ServerInfo,
} from './state';

export type GetProjectRequest = { projectId: string };
export type GetProjectResponse = ProjectState | null;

export type UpdatePanelRequest = PanelInfo;
export type UpdatePanelResponse = void;

export type UpdateConnectorRequest = ConnectorInfo;
export type UpdateConnectorResponse = void;

export type UpdateServerRequest = ServerInfo;
export type UpdateServerResponse = void;

export type UpdatePageRequest = ProjectPage;
export type UpdatePageResponse = void;

export type MakeProjectRequest = { projectId: string };
export type MakeProjectResponse = void;

export type OpenProjectRequest = void;
export type OpenProjectResponse = void;

export type GetProjectsRequest = void;
export type GetProjectsResponse = Array<{ name: string; createdAt: string }>;

export type UpdateSettingsRequest = Settings;
export type UpdateSettingsResponse = void;

export type GetSettingsRequest = void;
export type GetSettingsResponse = Settings;

export type PanelBody = { panelId: string };

export type StoreEndpoint =
  | 'getProjects'
  | 'makeProject'
  | 'updatePanel'
  | 'updatePage'
  | 'updateProject'
  | 'updateConnector'
  | 'updateServer'
  | 'getProject'
  | 'openProject'
  | 'getSettings'
  | 'updateSettings'
  | 'updateResults';

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
