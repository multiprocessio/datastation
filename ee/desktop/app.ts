// Copyright 2022 Multiprocess Labs LLC

import { app, ipcMain } from 'electron';
import path from 'path';
import { IS_DESKTOP_RUNNER } from '../../desktop/constants';
import { configureLogger } from '../../desktop/log';
import { openWindow } from '../../desktop/project';
import { registerRPCHandlers } from '../../desktop/rpc';
import { initialize } from '../../desktop/runner';
import { Endpoint } from '../shared/rpc';
import { DEBUG, VERSION } from '../../shared/constants';
import log from '../../shared/log';
import { APP_NAME } from '../shared/constants';
import { History } from './history';
import { Store } from './store';

const binaryExtension: Record<string, string> = {
  darwin: '',
  linux: '',
  win32: '.exe',
};

function main() {
  configureLogger();
  log.info(APP_NAME, VERSION, DEBUG ? 'DEBUG' : '');

  ['uncaughtException', 'unhandledRejection'].map((sig) =>
    process.on(sig, log.error)
  );

  // Just for basic unit tests
  if (app) {
    app.whenReady().then(async () => {
      const store = new Store();
      const { handlers, project } = initialize({
        subprocess: {
          node: path.join(__dirname, 'desktop_runner.js'),
          go: path.join(
            __dirname,
            'go_desktop_runner' + binaryExtension[process.platform]
          ),
        },
        additionalHandlers: store.getHandlers(),
      });

      await openWindow(project);

      const history = new History(store, handlers);
      registerRPCHandlers<Endpoint>(
        ipcMain,
        [...handlers, store.getHistoryHandler],
        history.audit
      );
    });

    app.on('window-all-closed', function () {
      if (process.platform !== 'darwin') app.quit();
    });
  }
}

if (!IS_DESKTOP_RUNNER) {
  main();
}
