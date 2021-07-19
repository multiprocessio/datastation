import child_process from 'child_process';
import path from 'path';

import { BrowserWindow, dialog } from 'electron';

import { VERSION } from '../shared/constants';

import { DSPROJ_FLAG, PROJECT_EXTENSION, DISK_ROOT } from './constants';

export async function openProject(win: BrowserWindow) {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    defaultPath: DISK_ROOT,
    filters: [
      {
        name: 'DataStation Projects',
        extensions: [PROJECT_EXTENSION],
      },
    ],
  });
  if (!filePaths.length) {
    return;
  }

  let processArgs = [DSPROJ_FLAG, filePaths[0]];
  if (VERSION === 'development') {
    processArgs = [
      '--trace-warning',
      '--unhandled-rejection=strict',
      'build/desktop.js',
    ].concat(processArgs);
  }

  // Launch disconnected child
  const child = child_process.spawn(process.argv[0], processArgs, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

export const getOpenProjectHandler = (win: BrowserWindow) => ({
  resource: 'openProject',
  handler: (_1: string, _2: any) => openProject(win),
});
