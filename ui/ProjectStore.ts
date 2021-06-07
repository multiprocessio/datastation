import { DEFAULT_PROJECT } from './constants';

export interface PanelInfo {
  content: string;
  type: 'table' | 'http' | 'graph' | 'program' | 'literal' | 'data';
}

export interface ProjectPage {
  panels: Array<PanelInfo>;
  name: string;
}

export interface ProjectState {
  pages: Array<ProjectPage>;
  projectName: string;
  currentPage: number;
  datasources: Array<any>;
}

class LocalStorageStore {
  init() {}

  #makeKey(projectId: string) {
    return `projectState:${projectId}`;
  }

  update(projectId: string, newState: ProjectState) {
    window.localStorage.setItem(
      this.#makeKey(projectId),
      JSON.stringify(newState)
    );
  }

  get(projectId: string) {
    try {
      const state = JSON.parse(
        window.localStorage.getItem(this.#makeKey(projectId))
      );
      if (!state) {
        return DEFAULT_PROJECT;
      }

      return state;
    } catch (e) {
      console.error(e);
      return DEFAULT_PROJECT;
    }
  }
}

class DesktopIPCStore {
  ipc: {
    ipcRenderer: {
      send: (name: string, projectId: string, state?: ProjectState) => void;
      once: (
        name: string,
        cb: (e: Event, messages: Array<ProjectState>) => void
      ) => void;
    };
  };

  async init() {
    this.ipc = await import('electron');
  }

  update(projectId: string, newState: ProjectState) {
    this.ipc.ipcRenderer.send('updateProjectState', projectId, newState);
  }

  async get(projectId: string) {
    return new Promise((resolve, reject) => {
      try {
        this.ipc.ipcRenderer.send('getProjectState', projectId);
        this.ipc.ipcRenderer.once(
          'receiveProjectState',
          (e: Event, messages: Array<ProjectState>) => {
            resolve(messages[0]);
          }
        );
      } catch (e) {
        reject(e);
      }
    });
  }
}

class HostedStore {
  init() {
    throw new Error('Unsupported store manager');
  }
}

export interface ProjectStore {
  init: () => Promise<void>;
  update: (projectId: string, state: ProjectState) => void;
  get: (projectId: string) => Promise<ProjectState>;
}

export function make(mode: string) {
  const store = {
    desktop: DesktopIPCStore,
    demo: LocalStorageStore,
    hosted: HostedStore,
  }[mode];
  return new store();
}
