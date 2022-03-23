// Copyright 2022 Multiprocess Labs LLC

import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { IS_DESKTOP_RUNNER } from '../../desktop/constants';
import { configureLogger } from '../../desktop/log';
import { openWindow } from '../../desktop/project';
import { registerRPCHandlers } from '../../desktop/rpc';
import { initialize } from '../../desktop/runner';
import { DEBUG, VERSION } from '../../shared/constants';
import log from '../../shared/log';
import { APP_NAME } from '../shared/constants';
import { Endpoint } from '../shared/rpc';
import { History } from './history';
import { RPCPayload } from './rpc';
import { Store } from './store';

const binaryExtension: Record<string, string> = {
  darwin: '',
  linux: '',
  win32: '.exe',
};

function dispatchWithMigrations(
  store: Store,
  dispatch: (payload: RPCPayload, external?: boolean) => Promise<any>
) {
  return function (payload: RPCPayload, external?: boolean) {
    const res = dispatch(payload, external);
    if (payload.resource === 'getProject') {
      const db = store.getConnection(payload.projectId);
      try {
        const migrationsBase = path.join(__dirname, 'migrations');
        const files = fs
          .readdirSync(migrationsBase)
          .filter((f) => f.endsWith('_ee.sql'));
        files.sort();
        for (const file of files) {
          log.info('Running migration: ' + file);
          const contents = fs
            .readFileSync(path.join(migrationsBase, file))
            .toString();
          db.exec(contents);
          log.info('Done migration: ' + file);
        }
      } catch (e) {
        log.error(e);
      }
    }

    return res;
  };
}

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
        dispatchWithMigrations(store, history.audit)
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
