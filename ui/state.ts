import React from 'react';
import { MODE } from '../shared/constants';
import {
  ConnectorInfo,
  PanelInfo,
  ProjectPage,
  ProjectState,
  ServerInfo,
} from '../shared/state';
import { makeStore } from './ProjectStore';

const store = makeStore(MODE);

export type ProjectCrud = {
  updatePanel: (panel: PanelInfo, position: number) => Promise<void>;
  deletePanel: (panelId: string) => Promise<void>;
  updatePage: (page: ProjectPage, position: number) => Promise<void>;
  deletePage: (pageId: string) => Promise<void>;
  updateConnector: (
    connector: ConnectorInfo,
    position: number
  ) => Promise<void>;
  deleteConnector: (connectorId: string) => Promise<void>;
  updateServer: (server: ServerInfo, position: number) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;
};

export function useProjectState(
  projectId: string,
  currentPage: number
): [ProjectState, ProjectCrud] {
  const [state, setProjectState] = React.useState<ProjectState>(null);

  const setState = React.useCallback(
    function setState(newState: ProjectState) {
      const c = { ...newState };
      Object.setPrototypeOf(c, ProjectState.prototype);
      setProjectState(c);
    },
    [projectId, store, setProjectState]
  );

  React.useEffect(
    function reReadStateWhenProjectIdChanges() {
      async function fetch() {
        let state;
        try {
          let rawState = await store.get(projectId);
          state = ProjectState.fromJSON(rawState);
        } catch (e) {
          log.error(e);
          window.location.href = '/';
        }

        // Why are we doing this here?
        state.projectName = projectId;
        setProjectState(state);
      }

      if (projectId) {
        fetch();
      }
    },
    [projectId]
  );

  function makeUpdater<T>(
    list: Array<T>,
    storeUpdate: (projectId: string, obj: T, position: number) => Promise<void>
  ): (obj: T, index: number) => Promise<void> {
    return function update(id: string, obj: T, index: number) {
      // Actually an insert
      if (index === -1) {
        list.push(obj);
        storeUpdate(state.projectName, obj, list.length - 1);
        setProjectState(state);
        return;
      }

      list[index] = obj;
      setProjectState(state);
      return storeUpdate(state.projectName, obj, index);
    };
  }

  function makeDeleter<T>(
    list: Array<T>,
    storeDelete: (projectId: string, id: string) => Promise<void>
  ): (id: string) => Promise<void> {
    return function del(id: string) {
      const index = (list || []).findIndex((c) => c.id === id);
      if (index === -1) {
        return;
      }

      list.splice(index, 1);
      setProjectState(state);
      return storeDelete(state.projectName, list[index].id);
    };
  }

  const crud = {
    updatePage: makeUpdater(state.pages, store.updatePage),
    deletePage: makeDeleter(state.pages, store.deletePage),

    updatePanel: makeUpdater(state.panels, store.updatePanel),
    deletePanel: makeDeleter(state.panels, store.deletePanel),

    updateConnector: makeUpdater(state.connectors, store.updateConnector),
    deleteConnector: makeDeleter(state.connectors, store.deleteConnector),

    updateServer: makeUpdater(state.servers, store.updateServer),
    deleteServer: makeDeleter(state.servers, store.deleteServer),
  };

  return [state, crud];
}

export const ProjectContext = React.createContext<{
  state: ProjectState;
  crud: ProjectCrud;
}>({
  state: new ProjectState(),
  crud: {
    updateServer(server: ServerInfo, position: number) {
      throw new Error('Context not initialized.');
    },
    deleteServer(serverId: string) {
      throw new Error('Context not initialized.');
    },
    updateConnector(connector: ConnectorInfo, position: number) {
      throw new Error('Context not initialized.');
    },
    deleteConnector(connectorId: string) {
      throw new Error('Context not initialized.');
    },
    updatePanel(panel: PanelInfo, position: number) {
      throw new Error('Context not initialized.');
    },
    deletePanel(panelId: string) {
      throw new Error('Context not initialized.');
    },
    updatePage(page: ProjectPage, position: number) {
      throw new Error('Context not initialized.');
    },
    deletePage(pageId: string) {
      throw new Error('Context not initialized.');
    },
  },
});
