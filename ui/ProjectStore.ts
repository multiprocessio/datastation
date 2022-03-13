import {
  DeleteConnectorRequest,
  DeleteConnectorResponse,
  DeletePageRequest,
  DeletePageResponse,
  DeletePanelRequest,
  DeletePanelResponse,
  DeleteServerRequest,
  DeleteServerResponse,
  GetProjectRequest,
  GetProjectResponse,
  UpdateConnectorRequest,
  UpdateConnectorResponse,
  UpdatePageRequest,
  UpdatePageResponse,
  UpdatePanelRequest,
  UpdatePanelResponse,
  UpdateServerRequest,
  UpdateServerResponse,
} from '../shared/rpc';
import {
  ConnectorInfo,
  PanelInfo,
  ProjectPage,
  ProjectState,
  ServerInfo,
} from '../shared/state';
import { asyncRPC } from './asyncRPC';

export class ProjectStore {
  updatePanel(
    projectId: string,
    p: PanelInfo,
    position: number
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  updatePage(
    projectId: string,
    p: ProjectPage,
    position: number
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  updateServer(
    projectId: string,
    p: ServerInfo,
    position: number
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  updateConnector(
    projectId: string,
    p: ConnectorInfo,
    position: number
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  deletePanel(projectId: string, id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  deletePage(projectId: string, id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  deleteServer(projectId: string, id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  deleteConnector(projectId: string, id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  get(projectId: string): Promise<ProjectState> {
    return Promise.reject('Not implemented');
  }
}

export class LocalStorageStore extends ProjectStore {
  makeKey(projectId: string) {
    return `projectState:${projectId}`;
  }

  // TODO: implement updaters/deleters

  get(projectId: string) {
    return JSON.parse(window.localStorage.getItem(this.makeKey(projectId)));
  }
}

class RemoteStore extends ProjectStore {
  updatePanel(projectId: string, data: PanelInfo, position: number) {
    return asyncRPC<UpdatePanelRequest, UpdatePanelResponse>('updatePanel', {
      data,
      position,
    });
  }

  updatePage(projectId: string, data: ProjectPage, position: number) {
    return asyncRPC<UpdatePageRequest, UpdatePageResponse>('updatePage', {
      data,
      position,
    });
  }

  updateServer(projectId: string, data: ServerInfo, position: number) {
    return asyncRPC<UpdateServerRequest, UpdateServerResponse>('updateServer', {
      data,
      position,
    });
  }

  updateConnector(projectId: string, data: ConnectorInfo, position: number) {
    return asyncRPC<UpdateConnectorRequest, UpdateConnectorResponse>(
      'updateConnector',
      { data, position }
    );
  }

  deletePanel(projectId: string, id: string) {
    return asyncRPC<DeletePanelRequest, DeletePanelResponse>('deletePanel', {
      id,
    });
  }

  deletePage(projectId: string, id: string) {
    return asyncRPC<DeletePageRequest, DeletePageResponse>('deletePage', {
      id,
    });
  }

  deleteServer(projectId: string, id: string) {
    return asyncRPC<DeleteServerRequest, DeleteServerResponse>('deleteServer', {
      id,
    });
  }

  deleteConnector(projectId: string, id: string) {
    return asyncRPC<DeleteConnectorRequest, DeleteConnectorResponse>(
      'deleteConnector',
      { id }
    );
  }

  get(projectId: string) {
    return asyncRPC<GetProjectRequest, GetProjectResponse>('getProject', {
      projectId,
    });
  }
}

export function makeStore(mode: string) {
  const storeClass = {
    desktop: RemoteStore,
    browser: LocalStorageStore,
    server: RemoteStore,
  }[mode];
  return new storeClass();
}
