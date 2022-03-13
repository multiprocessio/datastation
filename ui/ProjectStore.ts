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

  update(projectId: string, state: ProjectState) {
    window.localStorage.setItem(this.makeKey(projectId), JSON.stringify(state));
  }

  updatePanel = async (
    projectId: string,
    p: PanelInfo,
    position: number
  ): Promise<void> => {
    const state = await this.get(projectId);
    if (!state.pages) {
      state.pages = [];
    }

    for (const page of state.pages) {
      if (page.id === p.pageId) {
        if (!page.panels) {
          page.panels = [];
        }

        const existingPosition = page.panels.findIndex(
          (panel) => panel.id === p.id
        );
        if (existingPosition === -1) {
          page.panels.push(p);
        } else if (existingPosition === position) {
          page.panels[existingPosition] = p;
        } else {
          page.panels.splice(existingPosition, 1);
          page.panels.splice(position, 0, p);
        }

        this.update(projectId, state);
      }
    }
  };

  updatePage = async (
    projectId: string,
    p: ProjectPage,
    position: number
  ): Promise<void> => {
    const state = await this.get(projectId);
    if (!state.pages) {
      state.pages = [];
    }
    if (position === -1) {
      // New page
      state.pages.push(p);
    } else {
      state.pages[position] = p;
    }

    this.update(projectId, state);
  };

  updateServer = async (
    projectId: string,
    p: ServerInfo,
    position: number
  ): Promise<void> => {
    const state = await this.get(projectId);
    if (!state.servers) {
      state.servers = [];
    }
    if (position === -1) {
      // New server
      state.servers.push(p);
    } else {
      state.servers[position] = p;
    }

    this.update(projectId, state);
  };

  updateConnector = async (
    projectId: string,
    p: ConnectorInfo,
    position: number
  ): Promise<void> => {
    const state = await this.get(projectId);
    if (!state.connectors) {
      state.connectors = [];
    }
    if (position === -1) {
      // New connector
      state.connectors.push(p);
    } else {
      state.connectors[position] = p;
    }

    this.update(projectId, state);
  };

  deletePanel = async (projectId: string, id: string): Promise<void> => {
    const state = await this.get(projectId);
    if (!state.pages) {
      state.pages = [];
    }

    for (const page of state.pages) {
      if (page.id === id) {
        if (!page.panels) {
          page.panels = [];
        }

        const index = page.panels.findIndex((p) => p.id === id);
        if (index === -1) {
          return;
        }

        page.panels.splice(index, 1);
        this.update(projectId, state);
        return;
      }
    }
  };

  deletePage = async (projectId: string, id: string): Promise<void> => {
    const state = await this.get(projectId);
    if (!state.pages) {
      state.pages = [];
    }
    const index = state.pages.findIndex((p) => p.id === id);
    if (index === -1) {
      return;
    }

    state.pages.splice(index, 1);
    this.update(projectId, state);
    return;
  };

  deleteServer = async (projectId: string, id: string): Promise<void> => {
    const state = await this.get(projectId);
    if (!state.servers) {
      state.servers = [];
    }
    const index = state.servers.findIndex((p) => p.id === id);
    if (index === -1) {
      return;
    }

    state.servers.splice(index, 1);
    this.update(projectId, state);
    return;
  };

  deleteConnector = async (projectId: string, id: string): Promise<void> => {
    const state = await this.get(projectId);
    if (!state.connectors) {
      state.connectors = [];
    }
    const index = state.connectors.findIndex((p) => p.id === id);
    if (index === -1) {
      return;
    }

    state.connectors.splice(index, 1);
    this.update(projectId, state);
    return;
  };

  get(projectId: string): Promise<ProjectState> {
    const p = JSON.parse(window.localStorage.getItem(this.makeKey(projectId)));
    return Promise.resolve(p);
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
