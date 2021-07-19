import path from 'path';

import {
  BrowserWindow,
  dialog,
  Menu,
  MenuItemConstructorOptions,
  shell,
} from 'electron';

import { APP_NAME, VERSION, DEBUG, SITE_ROOT } from '../shared/constants';

import { DSPROJ_FLAG, PROJECT_EXTENSION, DISK_ROOT } from './constants';
import { SETTINGS } from './settings';

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
  ...(process.platform === 'darwin'
    ? [
        {
          label: 'Edit',
          submenu: [
            { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
            {
              label: 'Redo',
              accelerator: 'Shift+CmdOrCtrl+Z',
              selector: 'redo:',
            },
            { type: 'separator' },
            { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
            { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
            { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
            {
              label: 'Select All',
              accelerator: 'CmdOrCtrl+A',
              selector: 'selectAll:',
            },
          ],
        },
      ]
    : []),
  {
    label: 'View',
    submenu: [
      ...(DEBUG
        ? [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
          ]
        : []),
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  },
];

export async function openWindow(project: string) {
  const preload = path.join(__dirname, 'preload.js');
  const win = new BrowserWindow({
    width: 1400,
    height: 800,
    title: APP_NAME,
    webPreferences: {
      preload,
      devTools: DEBUG,
    },
  });

  if (!project) {
    project = SETTINGS.lastProject;
  } else {
    SETTINGS.lastProject = project;
  }
  (win as any).DS_project = SETTINGS.lastProject;
  await SETTINGS.save();

  const menu = Menu.buildFromTemplate(
    menuTemplate as MenuItemConstructorOptions[]
  );
  Menu.setApplicationMenu(menu);

  win.loadURL(
    'file://' + path.join(__dirname, 'index.html?project=' + project)
  );
}

export async function openProject() {
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

  await openWindow(filePaths[0]);
}

export const openProjectHandler = {
  resource: 'openProject',
  handler: (_1: string, _2: any) => openProject,
};
