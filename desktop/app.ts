import { app, ipcMain } from 'electron';
import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import log from '../shared/log';
import '../shared/polyfill';
import { configureLogger } from './log';
import { initialize } from './panel_runner';
import { openWindow } from './project';
import { registerRPCHandlers } from './rpc';

configureLogger().then(() => {
  log.info(APP_NAME, VERSION, DEBUG ? 'DEBUG' : '');
});
process.on('uncaughtException', (e) => {
  log.error(e);
});

app.whenReady().then(async () => {
  const { settings, handlers, project } = await initialize();

  await openWindow(project);

  registerRPCHandlers(ipcMain, handlers);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
