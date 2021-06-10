import * as path from 'path';

import { app, BrowserWindow, ipcMain } from 'electron';

import { APP_NAME, DEBUG } from './constants';
import { DesktopStore } from './electron-main/DesktopStore';
import { evalSQLHandler } from './electron-main/sql';

app.whenReady().then(() => {
  const preload = path.join(__dirname, 'preload.js');
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: APP_NAME,
    webPreferences: {
      preload,
    },
  });

  if (!DEBUG) {
    // In addition to removing the menu on Windows/Linux this also disables Chrome devtools.
    win.removeMenu();
  }
  win.loadFile('index.html');

  const store = new DesktopStore();
  registerRPCHandlers(ipcMain, [...store.handlers, evalSQLHandler]);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
