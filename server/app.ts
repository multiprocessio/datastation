import Hapi from '@hapi/hapi';
import inert from '@hapi/inert';
import fs from 'fs';
import path from 'path';
import { configureLogger } from '../desktop/log';
import { getRPCHandlers } from '../desktop/rpc';
import { loadSettings } from '../desktop/settings';
import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import log from '../shared/log';
import { handleRPC } from './rpc';

process.on('unhandledRejection', (e) => {
  console.log(e, 'wtf2');
  process.exit(1);
});
process.on('uncaughtException', (e) => {
  console.log('wtf');
  console.error(e);
});
configureLogger().then(() => {
  log.info(APP_NAME, VERSION, DEBUG ? 'DEBUG' : '');
});

async function init() {
  const server = Hapi.server({
    port: 3000,
    host: 'localhost',
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
  await server.register(inert);
  fs.readdirSync('build')
    .filter((f) => ['html', 'css', 'js', 'map'].includes(path.extname(f)))
    .map((f) => {
      server.route({
        method: 'GET',
        path: '/' + f,
        handler: (request, h) => h.file('build/' + f),
      });
    });

  await server.start();
  log.info('Server running on %s', server.info.uri);
}

init();
