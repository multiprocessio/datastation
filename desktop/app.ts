import { app, ipcMain } from 'electron';
import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import log from '../shared/log';
import '../shared/polyfill';
import { evalColumnsHandler } from './eval/columns';
import { DSPROJ_FLAG } from './constants';
import { evalFileHandler } from './eval/file';
import { evalHTTPHandler } from './eval/http';
import { configureLogger } from './log';
import { programHandlers } from './eval/program';
import { openProjectHandler, openWindow } from './project';
import { registerRPCHandlers, RPCHandler } from './rpc';
import { loadSettings } from './settings';
import { evalSQLHandler } from './eval/sql';
import { storeHandlers } from './store';

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
    evalColumnsHandler,
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
