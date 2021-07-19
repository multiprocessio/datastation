import path from 'path';

import { app, ipcMain } from 'electron';

import '../shared/polyfill';
import { APP_NAME, VERSION, DEBUG } from '../shared/constants';
import log from '../shared/log';

import { DSPROJ_FLAG } from './constants';
import { configureLogger } from './log';
import { storeHandlers } from './store';
import { registerRPCHandlers, RPCHandler } from './rpc';
import { evalSQLHandler } from './sql';
import { evalHTTPHandler } from './http';
import { evalFileHandler } from './file';
import { programHandlers } from './program';
import { openProject, openProjectHandler, openWindow } from './project';
import { loadSettings } from './settings';

configureLogger().then(() => {
  log.info(APP_NAME, VERSION, DEBUG ? 'DEBUG' : '');
});
process.on('uncaughtException', (e) => {
  log.error(e);
});

app.whenReady().then(async () => {
  let project = '';
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === DSPROJ_FLAG) {
      project = process.argv[i + 1];
      break;
    }
  }

  const settings = await loadSettings();

  await openWindow(project);

  registerRPCHandlers(ipcMain, [
    ...storeHandlers,
    evalSQLHandler,
    evalHTTPHandler,
    ...programHandlers,
    evalFileHandler,
    openProjectHandler,
    settings.getUpdateHandler(),
  ] as RPCHandler[]);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
