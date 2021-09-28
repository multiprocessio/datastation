import { app, ipcMain } from 'electron';
import { loadSettings } from '../desktop/settings';
import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import log from '../shared/log';
import '../shared/polyfill';
import { DSPROJ_FLAG } from './constants';
import { configureLogger } from './log';
import { panelHandlers } from './panel';
import { openProjectHandler, openWindow } from './project';
import { registerRPCHandlers, RPCHandler } from './rpc';
import { ensureSigningKey } from './secret';
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

  await ensureSigningKey();

  const settings = await loadSettings();

  await openWindow(project);

  const handlers: RPCHandler<any, any>[] = [
    ...storeHandlers,
    ...panelHandlers,
    openProjectHandler,
    settings.getUpdateHandler(),
  ];

  registerRPCHandlers(ipcMain, handlers);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
