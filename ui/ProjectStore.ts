import {
  GetProjectRequest,
  GetProjectResponse,
  UpdateProjectRequest,
  UpdateProjectResponse,
} from '@datastation/shared/rpc';
import { ProjectState } from '@datastation/shared/state';
import * as React from 'react';
import { asyncRPC } from './asyncRPC';

// This will store X copies of the entire state. Project state
// isn't that large though. So this may not be a big deal. In the future
// we could store only a diff.
// https://github.com/kpdecker/jsdiff could be interesting
class RestoreBuffer {
  size: number;
  buffers: Record<string, Array<string>>;
  constructor(size: number) {
    this.size = size;
    this.buffers = {};
  }

  push(projectId: string, state: ProjectState) {
    if (!this.buffers[projectId]) {
      this.buffers[projectId] = [];
    }

    if (this.buffers[projectId].length === this.size) {
      this.buffers[projectId].unshift();
    }

    this.buffers[projectId].push(JSON.stringify(state));
  }

  pop(projectId: string) {
    if (!this.buffers[projectId] || this.buffers[projectId].length < 2) {
      return null;
    }

    const states = this.buffers[projectId];
    states.pop();
    return JSON.parse(states[states.length - 1]) as ProjectState;
  }
}

export class ProjectStore {
  restoreBuffer: RestoreBuffer;
  constructor(restoreBufferSize: number) {
    this.restoreBuffer = new RestoreBuffer(restoreBufferSize);
  }

  update(projectId: string, state: ProjectState, addToRestoreBuffer = true) {
    if (addToRestoreBuffer) {
      this.restoreBuffer.push(projectId, state);
    }

    return Promise.resolve();
  }

  undo(projectId: string) {
    return this.restoreBuffer.pop(projectId);
  }

  get(projectId: string): Promise<ProjectState> {
    return Promise.reject('Not implemented');
  }
}

export class LocalStorageStore extends ProjectStore {
  makeKey(projectId: string) {
    return `projectState:${projectId}`;
  }

  update(projectId: string, newState: ProjectState, addToRestoreBuffer = true) {
    super.update(projectId, newState, addToRestoreBuffer);
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

class RPCStore extends ProjectStore {
  update(projectId: string, newState: ProjectState, addToRestoreBuffer = true) {
    super.update(projectId, newState, addToRestoreBuffer);
    return asyncRPC<UpdateProjectRequest, UpdateProjectResponse>(
      'updateProject',
      newState
    );
  }

  get(projectId: string) {
    return asyncRPC<GetProjectRequest, GetProjectResponse>('getProject', {
      projectId,
    });
  }
}

export function makeStore(mode: string, restoreBufferSize = 50) {
  const storeClass = {
    desktop: RPCStore,
    browser: LocalStorageStore,
    server: RPCStore,
  }[mode];
  return new storeClass(restoreBufferSize);
}

export const ProjectContext = React.createContext<{
  state: ProjectState;
  setState: (a0: Partial<ProjectState>) => void;
}>({
  state: new ProjectState(),
  setState(a) {
    throw new Error('Context not initialized.');
  },
});
