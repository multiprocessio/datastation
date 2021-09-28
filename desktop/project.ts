import {
  BrowserWindow,
  dialog,
  Menu,
  MenuItemConstructorOptions,
  shell,
} from 'electron';
import path from 'path';
import { APP_NAME, CHAT_LINK, DEBUG, SITE_ROOT } from '../shared/constants';
import { DISK_ROOT, PROJECT_EXTENSION } from './constants';
import { RPCHandler } from './rpc';
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
        label: 'New Project',
        click: () => openWindow('', true),
        accelerator: 'CmdOrCtrl+N',
      },
      {
        label: 'Open Project',
        click: openProject,
        accelerator: 'CmdOrCtrl+O',
      },
      {
        label: 'Close Project',
        accelerator: 'CmdOrCtrl+W',
        role: process.platform === 'darwin' ? 'close' : 'quit',
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
        label: 'Community Chat',
        click: () => shell.openExternal(CHAT_LINK),
      },
    ],
  },
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
  {
    label: 'View',
    submenu: [
      ...(DEBUG ? [{ role: 'toggleDevTools' }, { type: 'separator' }] : []),
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  },
];

export async function openWindow(project: string, newProject: boolean = false) {
  if (!newProject) {
    if (!project) {
      project = SETTINGS.lastProject;
    } else {
      SETTINGS.lastProject = project;
    }
    await SETTINGS.save();
  }

  const preload = path.join(__dirname, 'preload.js');
  const win = new BrowserWindow({
    width: project ? 1400 : 600,
    height: project ? 800 : 600,
    title: APP_NAME,
    webPreferences: {
      preload,
      devTools: DEBUG,
    },
  });

  const menu = Menu.buildFromTemplate(
    menuTemplate as MenuItemConstructorOptions[]
  );
  Menu.setApplicationMenu(menu);

  win.loadURL(
    'file://' +
      path.join(
        __dirname,
        'index.html' + (project ? '?project=' + project : '')
      )
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

export const openProjectHandler: RPCHandler<void, void> = {
  resource: 'openProject',
  handler: openProject,
};
