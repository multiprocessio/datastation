import { app, ipcMain } from 'electron';
import path from 'path';
import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import log from '../shared/log';
import '../shared/polyfill';
import { configureLogger } from './log';
import { openWindow } from './project';
import { registerRPCHandlers } from './rpc';
import { initialize } from './runner';

configureLogger().then(() => {
  log.info(APP_NAME, VERSION, DEBUG ? 'DEBUG' : '');
});
process.on('uncaughtException', (e) => {
  log.error(e);
});
process.on('unhandledRejection', (e) => {
  log.error(e);
});

app.whenReady().then(async () => {
  const { handlers, project } = await initialize({
    subprocess: path.join(__dirname, 'desktop_runner.js'),
  });

  await openWindow(project);

  registerRPCHandlers(ipcMain, handlers);
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
