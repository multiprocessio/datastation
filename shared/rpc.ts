import { Settings } from './settings';
import {
  ConnectorInfo,
  Dashboard,
  Export,
  PanelInfo,
  ProjectPage,
  ProjectState,
  ServerInfo,
} from './state';

export type GetProjectRequest = { projectId: string };
export type GetProjectResponse = ProjectState | null;

export type GetPanelRequest = { id: string };
export type GetPanelResponse = PanelInfo;

export type UpdatePanelRequest = {
  position: number;
  data: PanelInfo;
};
export type UpdatePanelResponse = void;

export type GetConnectorRequest = { id: string };
export type GetConnectorResponse = ConnectorInfo;

export type UpdateConnectorRequest = {
  position: number;
  data: ConnectorInfo;
};
export type UpdateConnectorResponse = void;

export type GetServerRequest = { id: string };
export type GetServerResponse = ServerInfo;

export type UpdateServerRequest = {
  position: number;
  data: ServerInfo;
};
export type UpdateServerResponse = void;

export type GetPageRequest = { id: string };
export type GetPageResponse = ProjectPage;

export type UpdatePageRequest = {
  position: number;
  data: ProjectPage;
};
export type UpdatePageResponse = void;

export type DeletePageRequest = { id: string };
export type DeletePageResponse = void;

export type DeletePanelRequest = { id: string };
export type DeletePanelResponse = void;

export type DeleteServerRequest = { id: string };
export type DeleteServerResponse = void;

export type DeleteConnectorRequest = { id: string };
export type DeleteConnectorResponse = void;

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

export type UpdateExportRequest = Export;
export type UpdateExportResponse = void;

export type DeleteExportRequest = { id: string };
export type DeleteExportResponse = void;

export type GetExportsRequest = void;
export type GetExportsResponse = Array<Export>;

export type UpdateDashboardRequest = Dashboard;
export type UpdateDashboardResponse = void;

export type DeleteDashboardRequest = { id: string };
export type DeleteDashboardResponse = void;

export type GetDashboardsRequest = void;
export type GetDashboardsResponse = Array<Dashboard>;

export type StoreEndpoint =
  | 'getProjects'
  | 'makeProject'
  | 'updatePanel'
  | 'updatePage'
  | 'updateProject'
  | 'updateConnector'
  | 'updateServer'
  | 'getPage'
  | 'getPanel'
  | 'getConnector'
  | 'getServer'
  | 'deletePanel'
  | 'deletePage'
  | 'deleteConnector'
  | 'deleteServer'
  | 'getProject'
  | 'openProject'
  | 'getSettings'
  | 'updateSettings'
  | 'getDashboards'
  | 'deleteDashboard'
  | 'updateDashboard'
  | 'getExports'
  | 'deleteExport'
  | 'updateExport'
  | 'updatePanelResult';

export type PanelBody = { panelId: string };
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
