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
    _projectId: string,
    _p: PanelInfo,
    _position: number,
    _insert: boolean,
    _panelPositions?: string[]
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  updatePage(
    _projectId: string,
    _p: ProjectPage,
    _position: number,
    _insert: boolean
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  updateServer(
    _projectId: string,
    _p: ServerInfo,
    _position: number,
    _insert: boolean
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  updateConnector(
    _projectId: string,
    _p: ConnectorInfo,
    _position: number,
    _insert: boolean
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  deletePanel(_projectId: string, _id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  deletePage(_projectId: string, _id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  deleteServer(_projectId: string, _id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  deleteConnector(_projectId: string, _id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  get(_projectId: string): Promise<ProjectState> {
    return Promise.reject('Not implemented');
  }
}

export class LocalStorageStore extends ProjectStore {
  makeKey(projectId: string) {
    return `projectState:${projectId}`;
  }

  async get(projectId: string): Promise<ProjectState> {
    // There are either bugs in Phil's code elsewhere or
    // localStorage.get/set are not actually truly synchronous. Because
    // without pulling out of the control flow here it returns with data
    // that is out of date even though we just called localstorage.set.
    await new Promise((r) => setTimeout(r, 10));
    return JSON.parse(window.localStorage.getItem(this.makeKey(projectId)));
  }

  async getOrCreate(projectId: string) {
    const proj = await this.get(projectId);
    if (proj) {
      return proj;
    }

    const n = new ProjectState();
    n.projectName = projectId;
    this.update(projectId, n);
    return n;
  }

  update(projectId: string, state: ProjectState) {
    window.localStorage.setItem(this.makeKey(projectId), JSON.stringify(state));
  }

  updatePanel = async (
    projectId: string,
    p: PanelInfo,
    position: number,
    insert: boolean,
    panelPositions?: string[]
  ): Promise<void> => {
    const state = await this.getOrCreate(projectId);
    if (!state.pages) {
      state.pages = [];
    }

    for (const page of state.pages) {
      if (page.id === p.pageId) {
        if (!page.panels) {
          page.panels = [];
        }

        if (insert) {
          page.panels.push(p);
        } else {
          const i = page.panels.findIndex((pp) => pp.id === p.id);
          page.panels[i] = p;
        }

        if (panelPositions) {
          // Then sort the existing ones based on the positions passed in
          page.panels.sort((a, b) => {
            const ao = panelPositions.indexOf(a.id);
            const bo = panelPositions.indexOf(b.id);

            // Put unknown items at the end
            if (ao === -1) {
              return 1;
            }

            return ao - bo;
          });
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
    const state = await this.getOrCreate(projectId);
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
    const state = await this.getOrCreate(projectId);
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
    const state = await this.getOrCreate(projectId);
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
    const state = await this.getOrCreate(projectId);
    if (!state.pages) {
      state.pages = [];
    }

    for (const page of state.pages) {
      if (!page.panels) {
        page.panels = [];
      }

      const index = page.panels.findIndex((p) => p.id === id);
      if (index === -1) {
        continue;
      }

      page.panels.splice(index, 1);
      this.update(projectId, state);
      return;
    }
  };

  deletePage = async (projectId: string, id: string): Promise<void> => {
    const state = await this.getOrCreate(projectId);
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
    const state = await this.getOrCreate(projectId);
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
    const state = await this.getOrCreate(projectId);
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
}

class RemoteStore extends ProjectStore {
  async updatePanel(
    projectId: string,
    data: PanelInfo,
    position: number,
    insert: boolean,
    panelPositions?: string[]
  ) {
    return asyncRPC<UpdatePanelRequest, UpdatePanelResponse>('updatePanel', {
      data,
      position,
      insert,
      panelPositions,
    });
  }

  updatePage(
    projectId: string,
    data: ProjectPage,
    position: number,
    insert: boolean
  ) {
    return asyncRPC<UpdatePageRequest, UpdatePageResponse>('updatePage', {
      data,
      position,
      insert,
    });
  }

  updateServer(
    projectId: string,
    data: ServerInfo,
    position: number,
    insert: boolean
  ) {
    return asyncRPC<UpdateServerRequest, UpdateServerResponse>('updateServer', {
      data,
      position,
      insert,
    });
  }

  updateConnector(
    projectId: string,
    data: ConnectorInfo,
    position: number,
    insert: boolean
  ) {
    return asyncRPC<UpdateConnectorRequest, UpdateConnectorResponse>(
      'updateConnector',
      { data, position, insert }
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
