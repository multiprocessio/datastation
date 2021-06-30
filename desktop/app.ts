import path from 'path';
import { spawn } from 'child_process';

import {
  app,
  BrowserWindow,
  Menu,
  MenuItemConstructorOptions,
  ipcMain,
  dialog,
  shell,
} from 'electron';

import { APP_NAME, DEBUG, SITE_ROOT } from '../shared/constants';

import { DISK_ROOT, PROJECT_EXTENSION } from './constants';
import { storeHandlers, ensureFile } from './store';
import { registerRPCHandlers } from './rpc';
import { evalSQLHandler } from './sql';
import { evalHTTPHandler } from './http';
import { evalProgramHandler } from './program';

const dsprojFlag = '--dsproj';

async function openProject() {
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
  if (filePaths.length) {
    let cmd = process.argv[0];
    let args = [dsprojFlag, filePaths[0]];
    if (cmd.toLowerCase().endsWith('electron')) {
      cmd = 'yarn';
      args = ['start-desktop', ...args];
    }
    console.log(`Spawning: "${cmd} ${args.join(' ')}"`);
    spawn(cmd, args);
  }
}

const menuTemplate = [
  ...(process.platform === 'darwin'
    ? [
        {
          label: APP_NAME,
          submenu: [{ role: 'quit' }],
        },
      ]
    : []),
  {
    label: 'File',
    submenu: [
      {
        label: 'Open Project',
        click: openProject,
      },
    ],
  },
  {
    label: 'Help',
    role: 'help',
    submenu: [
      {
        label: 'Documentation',
        click: () => shell.openExternal(`${SITE_ROOT}/docs/`),
      },
      {
        label: 'Community',
        click: () => shell.openExternal('https://discord.gg/f2wQBc4bXX'),
      },
    ],
  },
  ...(DEBUG
    ? [
        {
          label: 'View',
          submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
          ],
        },
      ]
    : []),
];

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

  let project = '';
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === dsprojFlag) {
      project = process.argv[i + 1];
      break;
    }
  }

  // Make sure this file/path exists
  await ensureFile('.settings');

  // TODO: write uuid as id to settings and send in /updates req

  const menu = Menu.buildFromTemplate(
    menuTemplate as MenuItemConstructorOptions[]
  );
  Menu.setApplicationMenu(menu);

  win.loadURL(
    'file://' + path.join(__dirname, 'index.html?project=' + project)
  );

  registerRPCHandlers(ipcMain, [
    ...storeHandlers,
    evalSQLHandler,
    evalHTTPHandler,
    evalProgramHandler,
    {
      resource: 'openProject',
      handler: (_1: string, _2: any) => openProject(),
    },
  ]);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
