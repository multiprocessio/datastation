import { spawn } from 'child_process';

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
  /* 
   *   const project = filePaths[0];
   *   let cmd = process.argv[0];
   *   let args = [DSPROJ_FLAG, project];
   *   if (cmd.toLowerCase().endsWith('electron')) {
   *     cmd = 'yarn';
   *     args = ['start-desktop', ...args];
   *   }
   * 
   *   console.log(`Spawning: "${cmd} ${args.join(' ')}"`);
   *   spawn(cmd, args); */
}

export const getOpenProjectHandler = (win: BrowserWindow) => {
  resource: 'openProject',
  handler: (_1: string, _2: any) => openProject(win),
};
