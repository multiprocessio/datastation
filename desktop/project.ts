import path from 'path';

import { BrowserWindow, dialog } from 'electron';

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

  win.loadURL(
    'file://' + path.join(__dirname, 'index.html?project=' + filePaths[0])
  );
}

export const getOpenProjectHandler = (win: BrowserWindow) => ({
  resource: 'openProject',
  handler: (_1: string, _2: any) => openProject(win),
});
