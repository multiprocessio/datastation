import { IpcRenderer } from 'electron';
import debounce from 'lodash.debounce';
import * as React from 'react';

import { ProjectState, DEFAULT_PROJECT } from '../shared/state';

import { asyncRPC } from './asyncRPC';

export interface PanelResult {
  exception?: string;
  value?: Array<any>;
  lastRun: Date;
}

class LocalStorageStore {
  makeKey(projectId: string) {
    return `projectState:${projectId}`;
  }

  update(projectId: string, newState: ProjectState) {
    window.localStorage.setItem(
      this.makeKey(projectId),
      JSON.stringify(newState)
    );
    return Promise.resolve();
  }

  get(projectId: string) {
    return JSON.parse(window.localStorage.getItem(this.makeKey(projectId)));
  }
}

class DesktopIPCStore {
  update(projectId: string, newState: ProjectState) {
    return asyncRPC<ProjectState, string, void>(
      'updateProjectState',
      projectId,
      newState
    );
  }

  get(projectId: string) {
    return asyncRPC<ProjectState, string, ProjectState>(
      'getProjectState',
      projectId
    );
  }
}

class HostedStore {
  async update(projectId: string, state: ProjectState) {
    throw new Error('Unsupported state manager');
  }

  async get(): Promise<ProjectState> {
    throw new Error('Unsupported state manager');
  }
}

export interface ProjectStore {
  update: (projectId: string, state: ProjectState) => Promise<void>;
  get: (projectId: string) => Promise<ProjectState>;
}

export function makeStore(mode: string, syncMillis: number = 5000) {
  const storeClass = {
    desktop: DesktopIPCStore,
    browser: LocalStorageStore,
    hosted: HostedStore,
  }[mode];
  const store = new storeClass();
  if (syncMillis) {
    store.update = debounce<[string, ProjectState], Promise<void>>(
      store.update.bind(store),
      syncMillis
    );
  }
  return store;
}

export const ProjectContext =
  React.createContext<ProjectState>(DEFAULT_PROJECT);
