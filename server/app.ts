import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import express from 'express';
import path from 'path';
import { CODE_ROOT } from '../desktop/constants';
import { getRPCHandlers } from '../desktop/rpc';
import { loadSettings } from '../desktop/settings';
import '../shared/polyfill';
import { registerAuth } from './auth';
import { Config, readConfig } from './config';
import log from './log';
import { handleRPC } from './rpc';

export class App {
  express: express.Express;
  config: Config;

  constructor(config: Config) {
    this.express = express();
    this.config = config;
  }
}

export async function init() {
  const config = await readConfig();
  const app = new App(config);

  app.express.use(cookieParser());
  app.express.use(bodyParser.urlencoded({ extended: true }));

  const settings = await loadSettings();
  const rpcHandlers = getRPCHandlers(settings);

  const auth = await registerAuth('/a/auth', app, config);

  app.express.use('/a/rpc', auth.requireAuth, (req, rsp) =>
    handleRPC(req, rsp, rpcHandlers)
  );

  // Serve static files
  // Mask with nginx in production
  const staticFiles = ['index.html', 'style.css', 'ui.js', 'ui.js.map'];
  staticFiles.map((f) => {
    if (f === 'index.html') {
      app.express.get('/', (req, rsp) =>
        rsp.sendFile(path.join(CODE_ROOT, '/build/index.html'))
      );
      return;
    }

    app.express.get('/' + f, (req, rsp) =>
      rsp.sendFile(path.join(CODE_ROOT, 'build', f))
    );
  });

  const server = app.express.listen(config.server.port, () => {
    log.info(
      `Server running on https://${config.server.address}:${config.server.port}, publicly accessible at ${config.server.publicUrl}`
    );
  });

  process.on('SIGINT', async function () {
    log.info('Gracefully shutting down from SIGINT');
    server.close(() => process.exit(1));
  });
}
