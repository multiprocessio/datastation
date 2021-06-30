import { IpcRenderer } from 'electron';
import * as React from 'react';

import { ProjectState, DEFAULT_PROJECT, PanelResult } from '../shared/state';

import { asyncRPC } from './asyncRPC';

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

export interface ProjectStore {
  update: (projectId: string, state: ProjectState) => Promise<void>;
  get: (projectId: string) => Promise<ProjectState>;
}

export function makeStore(mode: string) {
  const storeClass = {
    desktop: DesktopIPCStore,
    browser: LocalStorageStore,
  }[mode];
  return new storeClass();
}

export const ProjectContext =
  React.createContext<ProjectState>(DEFAULT_PROJECT);
