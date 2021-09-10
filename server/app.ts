import Hapi from '@hapi/hapi';
import inert from '@hapi/inert';
import { getRPCHandlers } from '../desktop/rpc';
import { loadSettings } from '../desktop/settings';
import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import log from '../shared/log';
import '../shared/polyfill';
import { handleRPC } from './rpc';

process.on('unhandledRejection', (e) => {
  log.error(e);
  process.exit(1);
});
process.on('uncaughtException', (e) => {
  log.info('here');
  log.error(e);
});
log.info(APP_NAME, VERSION, DEBUG ? 'DEBUG' : '');

async function init() {
  const server = Hapi.server({
    port: 8080,
    host: 'localhost',
  });

  process.on('SIGINT', async function () {
    log.info('Gracefully shutting down from SIGINT');
    await server.stop({ timeout: 10000 });
    process.exit(1);
  });

  const settings = await loadSettings();
  const rpcHandlers = getRPCHandlers(settings);

  server.route({
    method: 'POST',
    path: '/rpc',
    handler: (h, r) => handleRPC(h, r, rpcHandlers),
  });

  // Serve static files
  // Mask with nginx in production
  const staticFiles = ['index.html', 'style.css', 'ui.js', 'ui.js.map'];
  await server.register(inert);
  staticFiles.map((f) => {
    if (f === 'index.html') {
      server.route({
        method: 'GET',
        path: '/',
        handler: (request, h) => h.file('build/' + f),
      });
    }
    server.route({
      method: 'GET',
      path: '/' + f,
      handler: (request, h) => h.file('build/' + f),
    });
  });

  await server.start();
  log.info(`Server running on ${server.info.uri}`);
}

init();
