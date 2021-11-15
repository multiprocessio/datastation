import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import pg, { Pool } from 'pg';
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

    const [host, port] = this.config.database.address.split(':');
    this.dbpool = new Pool({
      user: this.config.database.username || '',
      password: this.config.database.password || '',
      database: this.config.database.database,
      host,
      port: +port || undefined,
    });
  }

  async migrate() {
    log.info('Starting migrations');
    const migrationsDirectory = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDirectory);
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
          const migration = fs
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
}

export async function init(runServer = true) {
  const config = readConfig();
  const app = new App(config);
  await app.migrate();

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
