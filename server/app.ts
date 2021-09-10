import path from 'path';
import fs from 'fs';
import Hapi from '@hapi/hapi';
import napa from 'napajs';
import { handleRPC } from './rpc';

async function init() {
  const server = Hapi.server({
    port: 3000,
    host: 'localhost'
  });

  server.route({
    method: 'POST',
    path: '/rpc',
    handler: handleRPC,
  });

  // Serve static files
  // Mask with nginx in production
  fs.readdirSync('build').filter(f => ['html', 'css', 'js', 'map'].includes(path.extname(f))).map(f => {
    server.route({
      method: 'GET',
      path: '/'+f,
      handler: (request, h) => h.file('build/'+f),
    });
  });

  await server.start();
  console.log('Server running on %s', server.info.uri);
}

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

init();
