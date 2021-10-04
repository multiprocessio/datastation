import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'fs';
import https from 'https';
import path from 'path';
import pg from 'pg';
import { CODE_ROOT } from '../desktop/constants';
import { humanSize } from '../shared/text';
import { registerAuth } from './auth';
import { Config, readConfig } from './config';
import log from './log';
import { handleRPC } from './rpc';
import { initialize } from './runner';

export class App {
  express: express.Express;
  config: Config;
  dbpool: pg.Pool;

  constructor(config: Config) {
    this.express = express();
    this.config = config;
  }
}

export async function init() {
  const config = await readConfig();
  const app = new App(config);

  app.express.use(cookieParser());
  app.express.use(express.json());

  app.express.use((req, res, next) => {
    const start = new Date();
    res.on('finish', () => {
      const end = new Date();
      log.info(
        `${res.statusCode} ${req.method} ${req.url} ${humanSize(
          +res.getHeader('content-length') || 0
        )} ${end.valueOf() - start.valueOf()}ms`
      );
    });
    next();
  });

  const { handlers } = await initialize(app, {
    subprocess: path.join(__dirname, 'server_runner.js'),
  });

  const auth = await registerAuth('/a/auth', app, config);

  app.express.post('/a/rpc', auth.requireAuth, (req, rsp) =>
    handleRPC(req, rsp, handlers)
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

  const server = https.createServer(
    {
      key: fs.readFileSync(config.server.tlsKey),
      cert: fs.readFileSync(config.server.tlsCert),
    },
    app.express
  );
  const location = config.server.address + ':' + config.server.port;
  server.listen(
    {
      port: config.server.port,
      host: config.server.address,
    },
    () => {
      log.info(
        `Server running on https://${location}, publicly accessible at ${config.server.publicUrl}`
      );
    }
  );

  process.on('SIGINT', async function () {
    log.info('Gracefully shutting down from SIGINT');
    server.close(() => process.exit(1));
  });
}
