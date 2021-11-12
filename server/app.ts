import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import pg from 'pg';
import { CODE_ROOT } from '../desktop/constants';
import { humanSize } from '../shared/text';
import { registerAuth } from './auth';
import { Config, readConfig } from './config';
import log from './log';
import migrate from './migrate';
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

export function migrate(app: App) {
  const files = fs.readdirSync(path.join(__dirname, 'migrations'));
  files.sort();
  console.log(files);
  throw new Error();
}

export async function init(runServer = true) {
  const config = readConfig();
  const app = new App(config);

  await migrate(app);

  const { handlers } = initialize(app, {
    subprocess: path.join(__dirname, 'server_runner.js'),
  });

  if (runServer) {
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

    const server = config.server.tlsKey
      ? https.createServer(
          {
            key: fs.readFileSync(config.server.tlsKey),
            cert: fs.readFileSync(config.server.tlsCert),
          },
          app.express
        )
      : http.createServer(app.express);
    const location = config.server.address + ':' + config.server.port;
    server.listen(
      {
        port: config.server.port,
        host: config.server.address,
      },
      () => {
        const protocol = config.server.tlsKey ? 'https' : 'http';
        log.info(
          `Server running on ${protocol}://${location}, publicly accessible at ${config.server.publicUrl}`
        );
      }
    );

    process.on('SIGINT', async function () {
      log.info('Gracefully shutting down from SIGINT');
      server.close(() => process.exit(1));
    });
  }

  return handlers;
}
