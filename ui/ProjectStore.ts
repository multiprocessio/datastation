import { IpcRenderer } from 'electron';
import * as React from 'react';

import { asyncRPC } from './asyncRPC';
import { ProjectState } from '../shared/store';

export interface PanelResult {
  exception?: string;
  value?: Array<any>;
  lastRun: Date;
}

class LocalStorageStore {
  #makeKey(projectId: string) {
    return `projectState:${projectId}`;
  }

  update(projectId: string, newState: ProjectState) {
    window.localStorage.setItem(
      this.#makeKey(projectId),
      JSON.stringify(newState)
    );
    return Promise.resolve();
  }

  get(projectId: string) {
    return JSON.parse(window.localStorage.getItem(this.#makeKey(projectId)));
  }
}

class DesktopIPCStore {
  update(projectId: string, newState: ProjectState) {
    return asyncRpc<ProjectState, string, void>(
      'updateProjectState',
      projectId,
      newState
    );
  }

  get(projectId: string) {
    return asyncRpc<ProjectState, string, ProjectState>(
      'getProjectState',
      projectId
    );
  }
}

class HostedStore {
  async update(projectId: string, state: ProjectState) {
    throw new Error('Unsupported store manager');
  }

  async get(): Promise<ProjectState> {
    throw new Error('Unsupported store manager');
  }
}

export interface ProjectStore {
  update: (projectId: string, state: ProjectState) => Promise<void>;
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

export const DEFAULT_PROJECT: ProjectState = {
  projectName: 'Untitled project',
  connectors: [],
  pages: [
    {
      name: 'Untitled page',
      panels: [
        new LiteralPanelInfo(
          'Raw CSV Text',
          'csv',
          'name,age\nPhil,12\nJames,17'
        ),
        (() => {
          const panel = new GraphPanelInfo('Display');
          panel.graph.y = { field: 'age', label: 'Age' };
          return panel;
        })(),
      ],
    },
  ],
  currentPage: 0,
};

export const ProjectContext =
  React.createContext<ProjectState>(DEFAULT_PROJECT);
