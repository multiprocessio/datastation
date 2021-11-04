import { app, ipcMain } from 'electron';
import path from 'path';
import { APP_NAME, DEBUG, VERSION } from '@datastation/shared/constants';
import log from '@datastation/shared/log';
import { IS_DESKTOP_RUNNER } from './constants';
import { initialize } from './initialize';
import { configureLogger } from './log';
import { openWindow } from './project';
import { registerRPCHandlers } from './rpc';
import { flushUnwritten, storeHandlers } from './store';

function main() {
  configureLogger();
  log.info(APP_NAME, VERSION, DEBUG ? 'DEBUG' : '');

  ['uncaughtException', 'unhandledRejection'].map((sig) =>
    process.on(sig, log.error)
  );

  // There doesn't seem to be a catchall signal
  ['exit', 'SIGUSR1', 'SIGUSR2', 'SIGINT'].map((sig) =>
    process.on(sig, flushUnwritten)
  );

  // Just for basic unit tests
  if (app) {
    app.whenReady().then(async () => {
      const { handlers, project } = initialize({
        runner: path.join(__dirname, 'desktop_runner.js'),
        additionalHandlers: storeHandlers,
      });

      await openWindow(project);

      registerRPCHandlers(ipcMain, handlers);
    });

    app.on('window-all-closed', function () {
      if (process.platform !== 'darwin') app.quit();
    });
  }
}

if (!IS_DESKTOP_RUNNER) {
  main();
}
