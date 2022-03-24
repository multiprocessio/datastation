import React from 'react';
import { MODE } from '../shared/constants';
import log from '../shared/log';
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
  updatePanel: (
    panel: PanelInfo,
    position: number,
    opts?: { internalOnly: boolean }
  ) => Promise<void>;
  deletePanel: (panelId: string) => Promise<void>;
  updatePage: (
    page: ProjectPage,
    position: number,
    opts?: { internalOnly: boolean }
  ) => Promise<void>;
  deletePage: (pageId: string) => Promise<void>;
  updateConnector: (
    connector: ConnectorInfo,
    position: number,
    opts?: { internalOnly: boolean }
  ) => Promise<void>;
  deleteConnector: (connectorId: string) => Promise<void>;
  updateServer: (
    server: ServerInfo,
    position: number,
    opts?: { internalOnly: boolean }
  ) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;
};

const defaultCrud = {
  updateServer(
    server: ServerInfo,
    position: number,
    opts?: { internalOnly: true }
  ) {
    throw new Error('Context not initialized.');
  },
  deleteServer(serverId: string) {
    throw new Error('Context not initialized.');
  },
  updateConnector(
    connector: ConnectorInfo,
    position: number,
    opts?: { internalOnly: true }
  ) {
    throw new Error('Context not initialized.');
  },
  deleteConnector(connectorId: string) {
    throw new Error('Context not initialized.');
  },
  updatePanel(
    panel: PanelInfo,
    position: number,
    opts?: { internalOnly: true }
  ) {
    throw new Error('Context not initialized.');
  },
  deletePanel(panelId: string) {
    throw new Error('Context not initialized.');
  },
  updatePage(
    page: ProjectPage,
    position: number,
    opts?: { internalOnly: true }
  ) {
    throw new Error('Context not initialized.');
  },
  deletePage(pageId: string) {
    throw new Error('Context not initialized.');
  },
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

  async function reread(projectId: string) {
    let state;
    try {
      let rawState = await store.get(projectId);
      state = ProjectState.fromJSON(rawState);
    } catch (e) {
      log.error(e);
      window.location.href = '/';
    }

    setProjectState(state);
  }

  React.useEffect(
    function reReadStateWhenProjectIdChanges() {
      if (projectId) {
        reread(projectId);
      }
    },
    [projectId]
  );

  function makeUpdater<T extends { id: string }>(
    list: Array<T>,
    storeUpdate: (projectId: string, obj: T, position: number) => Promise<void>,
    opts?: { internalOnly: boolean }
  ): (
    obj: T,
    index: number,
    opts?: { internalOnly: boolean }
  ) => Promise<void> {
    return async function update(
      obj: T,
      index: number,
      opts?: { internalOnly: boolean }
    ) {
      const internalOnly = opts ? opts.internalOnly : false;
      if (internalOnly) {
        return;
      }
      // Actually an insert
      if (index === -1) {
        list.push(obj);
        setState(state);
        await storeUpdate(projectId, obj, list.length - 1);
        await reread(projectId);
        return;
      }

      list[index] = obj;
      setState(state);
      await storeUpdate(projectId, obj, index);
      return reread(projectId);
    };
  }

  function makeDeleter<T extends { id: string }>(
    list: Array<T>,
    storeDelete: (projectId: string, id: string) => Promise<void>
  ): (id: string) => Promise<void> {
    return async function del(id: string) {
      const index = (list || []).findIndex((c) => c.id === id);
      if (index === -1) {
        return;
      }

      list.splice(index, 1);
      setState(state);
      await storeDelete(projectId, id);
      return reread(projectId);
    };
  }

  const crud = !state
    ? defaultCrud
    : {
        updatePage: makeUpdater(state.pages, store.updatePage),
        deletePage: makeDeleter(state.pages, store.deletePage),

        updatePanel(
          obj: PanelInfo,
          index: number,
          opts?: { internalOnly: true }
        ) {
          const page = state.pages.find((p) => obj.pageId);
          return makeUpdater(page.panels, store.updatePanel)(obj, index, opts);
        },
        deletePanel(id: string) {
          const page = state.pages.find(
            (p) => p.panels.filter((pan) => pan.id === id).length > 0
          );
          if (!page) {
            return;
          }
          return makeDeleter(page.panels, store.deletePanel)(id);
        },

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
  crud: defaultCrud,
});
