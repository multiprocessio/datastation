import path from 'path';
import { spawn } from 'child_process';

import { app, BrowserWindow, Menu, ipcMain, dialog, shell } from 'electron';

import { APP_NAME, DEBUG, DISK_ROOT } from '../shared/constants';
import { storeHandlers, ensureFile } from './store';
import { registerRPCHandlers } from './rpc';
import { evalSQLHandler } from './sql';
import { evalHTTPHandler } from './http';
import { evalProgramHandler } from './program';

const project = process.argv[1];

app.whenReady().then(async () => {
  const preload = path.join(__dirname, 'preload.js');
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: APP_NAME,
    webPreferences: {
      preload,
      devTools: DEBUG,
    },
  });

  // Make sure this file/path exists
  await ensureFile('.settings');

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Project',
          click: async () => {
            const { filePaths } = await dialog.showOpenDialog({
              properties: ['openFile'],
              defaultPath: DISK_ROOT,
              filters: [
                { name: 'DataStation Projects', extensions: ['.dsproj'] },
              ],
            });
            if (filePaths.length) {
              spawn(process.argv[0], filePaths);
            }
          },
        },
      ],
    },
    {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: () =>
            shell.openExternal('https://datastation.multiprocess.io/docs/'),
        },
        {
          label: 'Community',
          click: () => shell.openExternal('https://discord.gg/f2wQBc4bXX'),
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  win.loadFile(path.join(__dirname, 'index.html?project=' + project));

  registerRPCHandlers(ipcMain, [
    ...storeHandlers,
    evalSQLHandler,
    evalHTTPHandler,
    evalProgramHandler,
  ]);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
