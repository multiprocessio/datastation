import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { CODE_ROOT } from '../desktop/constants';
import { RPCHandler } from '../desktop/rpc';
import { initialize } from '../desktop/runner';
import { Store } from '../desktop/store';
import { humanSize } from '../shared/text';
import { registerAuth } from './auth';
import { Config } from './config';
import { registerDashboard } from './dashboard';
import log from './log';
import { handleRPC } from './rpc';

export class App {
  config: Config;
  express: express.Express;
  fs: typeof fs;
  http: typeof http;
  https: typeof https;

  constructor(config: Config) {
    this.express = express();
    this.config = config;

    // So these can be overridden in tests
    this.fs = fs;
    this.http = http;
    this.https = https;
    // Done for overrides
  }

  static make(config: Config) {
    return new App(config);
  }

  async serve(handlers: RPCHandler<any, any>[]) {
    this.express.use(cookieParser());
    this.express.use(express.json());

    this.express.use((req, res, next) => {
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
    const auth = await registerAuth('/a/auth', this, this.config);
    registerDashboard('/dashboard', '/a/dashboard', this, handlers);

    this.express.post('/a/rpc', auth.requireAuth, (req, rsp) =>
      handleRPC(req, rsp, handlers)
    );

    // Serve static files
    // Mask with nginx in production
    const staticFiles = ['index.html', 'style.css', 'ui.js', 'ui.js.map'];
    staticFiles.map((f) => {
      if (f === 'index.html') {
        this.express.get('/', (req, rsp) =>
          rsp.sendFile(path.join(CODE_ROOT, '/build/index.html'))
        );
        return;
      }

      this.express.get('/' + f, (req, rsp) =>
        rsp.sendFile(path.join(CODE_ROOT, 'build', f))
      );
    });

    // Must go last?
    this.express.get('*', (req: express.Request, rsp: express.Response) => {
      rsp.sendStatus(404);
    });

    const server = this.config.server.tlsKey
      ? this.https.createServer(
          {
            key: this.fs.readFileSync(this.config.server.tlsKey),
            cert: this.fs.readFileSync(this.config.server.tlsCert),
          },
          this.express
        )
      : this.http.createServer(this.express);
    const location = this.config.server.address + ':' + this.config.server.port;
    server.listen(
      {
        port: this.config.server.port,
        host: this.config.server.address,
      },
      () => {
        const protocol = this.config.server.tlsKey ? 'https' : 'http';
        log.info(
          `Server running on ${protocol}://${location}, publicly accessible at ${this.config.server.publicUrl}`
        );
      }
    );

    process.on('SIGINT', async function () {
      log.info('Gracefully shutting down from SIGINT');
      server.close(() => process.exit(1));
    });
  }

  getDashboards = {
    resource: 'getDashboards',
    handler: () => {},
  };

  updateDashboard = {
    resource: 'updateDashboards',
    handler: () => {},
  };

  getExports = {
    resource: 'getExports',
    handler: () => {},
  };

  updateExport = {
    resource: 'updateExports',
    handler: () => {},
  };

  getHandlers() {
    return [
      this.getDashboards,
      this.updateDashboard,
      this.getExports,
      this.updateExport,
    ];
  }
}

export async function init(app: App, withSubprocess = true) {
  const store = new Store();
  const { handlers } = initialize({
    subprocess: withSubprocess
      ? {
          node: path.join(__dirname, 'server_runner.js'),
          go: path.join(CODE_ROOT, 'build', 'go_server_runner'),
        }
      : undefined,
    additionalHandlers: [...store.getHandlers(), ...app.getHandlers()],
  });

  return { handlers };
}
