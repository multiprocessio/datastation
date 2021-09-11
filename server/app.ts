import express from 'express';
import path from 'path';
import { CODE_ROOT } from '../desktop/constants';
import { getRPCHandlers } from '../desktop/rpc';
import { loadSettings } from '../desktop/settings';
import { APP_NAME, DEBUG, SERVER_ROOT, VERSION } from '../shared/constants';
import log from '../shared/log';
import '../shared/polyfill';
import { handleRPC } from './rpc';

process.on('unhandledRejection', (e) => {
  log.error(e);
  process.exit(1);
});
process.on('uncaughtException', (e) => {
  log.error(e);
});
log.info(APP_NAME, VERSION, DEBUG ? 'DEBUG' : '');

async function init() {
  const app = express();

  const settings = await loadSettings();
  const rpcHandlers = getRPCHandlers(settings);

  app.post('/rpc', (req, rsp) => handleRPC(req, rsp, rpcHandlers));

  // Serve static files
  // Mask with nginx in production
  const staticFiles = ['index.html', 'style.css', 'ui.js', 'ui.js.map'];
  staticFiles.map((f) => {
    if (f === 'index.html') {
      app.get('/', (req, rsp) =>
        rsp.sendFile(path.join(CODE_ROOT, '/build/index.html'))
      );
      return;
    }

    app.get('/' + f, (req, rsp) =>
      rsp.sendFile(path.join(CODE_ROOT, 'build', f))
    );
  });

  const { port, hostname, protocol } = new URL(SERVER_ROOT);
  const server = app.listen(port, () => {
    log.info(`Server running on ${protocol}//${hostname}:${port}`);
  });

  process.on('SIGINT', async function () {
    log.info('Gracefully shutting down from SIGINT');
    server.close(() => process.exit(1));
  });
}

init();
