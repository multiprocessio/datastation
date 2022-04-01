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
    opts?: { internalOnly: boolean }
  ) {
    throw new Error('Context not initialized.');
  },
  deleteServer(serverId: string) {
    throw new Error('Context not initialized.');
  },
  updateConnector(
    connector: ConnectorInfo,
    position: number,
    opts?: { internalOnly: boolean }
  ) {
    throw new Error('Context not initialized.');
  },
  deleteConnector(connectorId: string) {
    throw new Error('Context not initialized.');
  },
  updatePanel(
    panel: PanelInfo,
    position: number,
    opts?: { internalOnly: boolean }
  ) {
    throw new Error('Context not initialized.');
  },
  deletePanel(panelId: string) {
    throw new Error('Context not initialized.');
  },
  updatePage(
    page: ProjectPage,
    position: number,
    opts?: { internalOnly: boolean }
  ) {
    throw new Error('Context not initialized.');
  },
  deletePage(pageId: string) {
    throw new Error('Context not initialized.');
  },
};

export function makeUpdater<T extends { id: string }>(
  projectId: string,
  list: Array<T>,
  storeUpdate: (
    projectId: string,
    obj: T,
    position: number,
    panelPositions?: string[]
  ) => Promise<void>,
  reread: (projectId: string) => Promise<void>
) {
  return async function update(
    obj: T,
    newIndex: number,
    opts?: { internalOnly: boolean }
  ) {
    const internalOnly = opts ? opts.internalOnly : false;

    const existingIndex = list.findIndex((i) => i.id === obj.id);

    // Actually an insert
    if (newIndex === -1) {
      list.push(obj);
      if (!internalOnly) {
        await storeUpdate(projectId, obj, list.length - 1);
      }
      await reread(projectId);
      return;
    }

    if (existingIndex >= 0) {
      list.splice(existingIndex, 1);
    }
    list.splice(newIndex, 0, obj);
    if (!internalOnly) {
      console.log(list.map((l) => [l.name, l.id]));
      await storeUpdate(
        projectId,
        obj,
        newIndex,
        list.map((l) => l.id)
      );
    }
    return reread(projectId);
  };
}

export function makeDeleter<T extends { id: string }>(
  projectId: string,
  list: Array<T>,
  storeDelete: (projectId: string, id: string) => Promise<void>,
  reread: (projectId: string) => Promise<void>
): (id: string) => Promise<void> {
  return async function del(id: string) {
    const index = (list || []).findIndex((c) => c.id === id);
    if (index === -1) {
      return;
    }

    list.splice(index, 1);
    await storeDelete(projectId, id);
    return reread(projectId);
  };
}

export function useProjectState(
  projectId: string,
  currentPage: number
): [ProjectState, ProjectCrud] {
  const [state, setProjectState] = React.useState<ProjectState>(null);

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

  const crud = !state
    ? defaultCrud
    : {
        updatePage: makeUpdater(
          projectId,
          state.pages,
          store.updatePage,
          reread
        ),
        deletePage: makeDeleter(
          projectId,
          state.pages,
          store.deletePage,
          reread
        ),

        updatePanel(
          obj: PanelInfo,
          index: number,
          opts?: { internalOnly: boolean }
        ) {
          const page = state.pages.find((p) => obj.pageId);
          return makeUpdater(
            projectId,
            page.panels,
            store.updatePanel,
            reread
          )(obj, index, opts);
        },
        deletePanel(id: string) {
          const page = state.pages.find(
            (p) => p.panels.filter((pan) => pan.id === id).length > 0
          );
          if (!page) {
            return;
          }
          return makeDeleter(
            projectId,
            page.panels,
            store.deletePanel,
            reread
          )(id);
        },

        updateConnector: makeUpdater(
          projectId,
          state.connectors,
          store.updateConnector,
          reread
        ),
        deleteConnector: makeDeleter(
          projectId,
          state.connectors,
          store.deleteConnector,
          reread
        ),

        updateServer: makeUpdater(
          projectId,
          state.servers,
          store.updateServer,
          reread
        ),
        deleteServer: makeDeleter(
          projectId,
          state.servers,
          store.deleteServer,
          reread
        ),
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
