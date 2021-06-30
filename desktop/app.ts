import path from 'path';

import {
  app,
  BrowserWindow,
  Menu,
  MenuItemConstructorOptions,
  ipcMain,
  shell,
} from 'electron';

import { APP_NAME, DEBUG, SITE_ROOT } from '../shared/constants';

import { DSPROJ_FLAG } from './constants';
import { storeHandlers } from './store';
import { registerRPCHandlers } from './rpc';
import { evalSQLHandler } from './sql';
import { evalHTTPHandler } from './http';
import { evalProgramHandler } from './program';
import { openProject, getOpenProjectHandler } from './project';
import { loadSettings } from './settings';

const menuTemplate = (win: BrowserWindow) => [
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
        click: () => openProject(win),
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
    if (process.argv[i] === DSPROJ_FLAG) {
      project = process.argv[i + 1];
      break;
    }
  }

  const settings = await loadSettings();
  if (!project) {
    project = settings.lastProject;
  } else {
    settings.lastProject = project;
  }
  await settings.save();

  const menu = Menu.buildFromTemplate(
    menuTemplate(win) as MenuItemConstructorOptions[]
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
    getOpenProjectHandler(win),
    settings.getUpdateHandler(),
  ]);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
