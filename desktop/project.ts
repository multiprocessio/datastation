import {
  BrowserWindow,
  dialog,
  Menu,
  MenuItemConstructorOptions,
  shell,
} from 'electron';
import path from 'path';
import { APP_NAME, CHAT_LINK, DEBUG, DOCS_ROOT } from '../shared/constants';
import { OpenProjectRequest, OpenProjectResponse } from '../shared/rpc';
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
        click: () => shell.openExternal(DOCS_ROOT),
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
      { type: 'separator' },
      {
        label: 'Settings',
        click: () =>
          openWindow('', false, {
            view: 'settings',
            width: 500,
            height: 500,
            hideMenu: true,
            title: 'DataStation Settings',
          }),
      },
    ],
  },
];

interface OpenWindowOverrides {
  width: number;
  height: number;
  view: string;
  title: string;
  hideMenu: boolean;
}

export async function openWindow(
  project: string,
  newProject: boolean = false,
  overrides: Partial<OpenWindowOverrides> = {}
) {
  // TODO: update last open project on window exit too
  if (!newProject) {
    if (!project) {
      project = SETTINGS.lastProject;
    } else {
      SETTINGS.lastProject = project;
    }

    if (SETTINGS.lastProject) {
      await SETTINGS.save();
    }
  }

  const preload = path.join(__dirname, 'preload.js');
  const win = new BrowserWindow({
    width: overrides.width || (project ? 1400 : 600),
    height: overrides.height || (project ? 800 : 600),
    title: overrides.title || APP_NAME,
    webPreferences: {
      preload,
      devTools: DEBUG,
    },
  });

  win.webContents.setWindowOpenHandler(function windowOpenHandler({ url }) {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const menu = Menu.buildFromTemplate(
    menuTemplate as MenuItemConstructorOptions[]
  );
  Menu.setApplicationMenu(menu);
  if (overrides.hideMenu) {
    win.removeMenu();
  }

  const args = {
    projectId: project,
    view: overrides.view || 'editor',
  };
  const params = Object.entries(args)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  win.loadURL('file://' + path.join(__dirname, 'index.html?' + params));
}

export async function openProject() {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    defaultPath: DISK_ROOT.value,
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

export const openProjectHandler: RPCHandler<
  OpenProjectRequest,
  OpenProjectResponse
> = {
  resource: 'openProject',
  handler: openProject,
};
