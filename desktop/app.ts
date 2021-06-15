import * as path from 'path';

import { app, BrowserWindow, ipcMain } from 'electron';

import { APP_NAME, DEBUG } from '../shared/constants';
import { storeHandlers } from './store';
import { registerRPCHandlers } from './rpc';
import { evalSQLHandler } from './sql';
import { evalHTTPHandler } from './http';

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
  win.loadFile(path.join(__dirname, 'index.html'));

  registerRPCHandlers(ipcMain, [
    ...storeHandlers,
    evalSQLHandler,
    evalHTTPHandler,
  ]);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
