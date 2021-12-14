import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import pg from 'pg';
import { CODE_ROOT } from '../desktop/constants';
import { RPCHandler } from '../desktop/rpc';
import { initialize } from '../desktop/runner';
import { humanSize } from '../shared/text';
import { registerAuth } from './auth';
import { Config } from './config';
import log from './log';
import { getProjectHandlers } from './project';
import { handleRPC } from './rpc';

type PgPoolFactory = (c: pg.PoolConfig) => pg.Pool;

export class App {
  config: Config;
  dbpool: pg.Pool;
  express: express.Express;
  fs: typeof fs;
  http: typeof http;
  https: typeof https;
  projectHandlers: RPCHandler<any, any>[];

  constructor(config: Config, poolFactory: PgPoolFactory) {
    this.express = express();
    this.config = config;

    // So these can be overridden in tests
    this.fs = fs;
    this.http = http;
    this.https = https;
    // Done for overrides

    const [host, port] = this.config.database.address.split('?')[0].split(':');
    this.dbpool = poolFactory({
      user: this.config.database.username || '',
      password: this.config.database.password || '',
      database: this.config.database.database,
      host,
      port: +port || undefined,
    });

    this.projectHandlers = getProjectHandlers(this.dbpool);
  }

  static make(config: Config) {
    return new App(config, (c: pg.PoolConfig) => new pg.Pool(c));
  }

  async migrate() {
    log.info('Starting migrations');
    const migrationsDirectory = path.join(__dirname, 'migrations');
    const files = this.fs.readdirSync(migrationsDirectory);
    files.sort();
    const client = await this.dbpool.connect();
    let migrations: Array<string> = [];
    try {
      try {
        const res = await client.query('SELECT migration_name FROM migrations');
        migrations = res.rows.map((r) => r.migration_name);
      } catch (e) {
        log.info(e);
      }

      for (const file of files) {
        if (migrations.includes(file)) {
          continue;
        }

        log.info('Starting migration: ' + file);
        await client.query('BEGIN');
        try {
          const migration = this.fs
            .readFileSync(path.join(migrationsDirectory, file))
            .toString();
          await client.query(migration);
          await client.query(
            'INSERT INTO migrations (migration_name) VALUES ($1)',
            [file]
          );
          await client.query('COMMIT');
          log.info('Finished migration: ' + file);
        } catch (e) {
          log.info('Failed to run migration: ' + file);
          await client.query('ROLLBACK');
          throw e;
        }
      }
    } finally {
      client.release();
    }

    log.info('Done migrations');
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
}

export async function init(app: App, withSubprocess = true) {
  const { handlers } = initialize({
    subprocess: withSubprocess
      ? {
          node: path.join(__dirname, 'server_runner.js'),
          go: path.join(CODE_ROOT, 'build', 'go_server_runner'),
        }
      : undefined,
    additionalHandlers: app.projectHandlers,
  });

  return { handlers };
}
