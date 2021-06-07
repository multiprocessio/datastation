import { IpcRenderer } from 'electron';

import { DEFAULT_PROJECT } from './constants';

export interface PanelResult {
  exception?: string;
  value?: Array<any>;
  lastRun: Date;
}

export type PanelInfoType = 'table' | 'http' | 'graph' | 'program' | 'literal';

export class PanelInfo {
  content: string;
  type: PanelInfoType;
  name: string;
  collapsed: boolean = false;
  details: boolean = false;

  constructor(name: string, type: PanelInfoType, content?: string) {
    this.content = content || '';
    this.type = type;
    this.name = name;
  }
}

export type ProgramPanelInfoType = 'javascript' | 'python';

export class ProgramPanelInfo extends PanelInfo {
  program: {
    type: ProgramPanelInfoType;
  };

  constructor(name: string, type?: ProgramPanelInfoType, content?: string) {
    super(name, 'program', content);
    this.program = {
      type: type || 'javascript',
    };
  }
}

export interface GraphY {
  field: string;
  label: string;
}

export type GraphPanelInfoType = 'bar';

export class GraphPanelInfo extends PanelInfo {
  graph: {
    panelSource: number;
    y: GraphY;
    x: string;
    type: GraphPanelInfoType;
  };

  constructor(
    name: string,
    panelSource?: number,
    y?: GraphY,
    x?: string,
    type?: GraphPanelInfoType,
    content?: string
  ) {
    super(name, 'graph', content);
    this.graph = {
      panelSource: panelSource || 0,
      x: x || '',
      y: y || { field: '', label: '' },
      type: type || 'bar',
    };
  }
}

export type HTTPPanelInfoType = 'csv' | 'json';

export class HTTPPanelInfo extends PanelInfo {
  http: {
    type: HTTPPanelInfoType;
  };

  constructor(name: string, type?: HTTPPanelInfoType, content?: string) {
    super(name, 'http', content);
    this.http = {
      type: type || 'json',
    };
  }
}

export interface TableColumn {
  label: string;
  field: string;
}

export class TablePanelInfo extends PanelInfo {
  table: {
    columns: Array<TableColumn>;
    panelSource: number;
  };

  constructor(
    name: string,
    columns: Array<TableColumn> = [],
    panelSource: number = 0,
    content?: string
  ) {
    super(name, 'table', content);
    this.table = {
      columns,
      panelSource,
    };
  }
}

export type LiteralPanelInfoType = 'csv' | 'json';

export class LiteralPanelInfo extends PanelInfo {
  literal: {
    type: LiteralPanelInfoType;
  };

  constructor(name: string, type?: LiteralPanelInfoType, content?: string) {
    super(name, 'literal', content);
    this.literal = {
      type: type || 'csv',
    };
  }
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
  async init() {}

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
  ipcRenderer: IpcRenderer;

  async init() {
    // TODO: maybe there's a simpler way to exclude this from the UI build?
    this.ipcRenderer = (await import('electron')).ipcRenderer;
  }

  update(projectId: string, newState: ProjectState) {
    this.ipcRenderer.send('updateProjectState', projectId, newState);
  }

  async get(projectId: string): Promise<ProjectState> {
    return new Promise((resolve, reject) => {
      try {
        this.ipcRenderer.send('getProjectState', projectId);
        this.ipcRenderer.once(
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
  async init() {
    throw new Error('Unsupported store manager');
  }

  update(projectId: string, state: ProjectState) {
    throw new Error('Unsupported store manager');
  }

  async get(): Promise<ProjectState> {
    throw new Error('Unsupported store manager');
  }
}

export interface ProjectStore {
  init: () => Promise<void>;
  update: (projectId: string, state: ProjectState) => void;
  get: (projectId: string) => Promise<ProjectState>;
}

export function makeStore(mode: string) {
  const store = {
    desktop: DesktopIPCStore,
    demo: LocalStorageStore,
    hosted: HostedStore,
  }[mode];
  return new store();
}
