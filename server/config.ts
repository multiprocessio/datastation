import fs from 'fs';
import { mergeDeep, validate } from '../shared/object';
import log from './log';

const CONFIG_PATH = '/usr/local/etc/datastation/config.json';

export class Config {
  auth: {
    sessionSecret: string;
    openId?: {
      realm: string;
      clientId: string;
      clientSecret: string;
    };
  };

  server: {
    port: number;
    address: string;
    publicUrl: string;
    tlsKey: string;
    tlsCert: string;
  };

  database: {
    address: string;
    username: string;
    password: string;
    database: string;
  };

  constructor() {
    this.auth = {
      sessionSecret: '',
    };
    this.server = {
      port: 8080,
      address: 'localhost',
      publicUrl: 'https://localhost:8080',
      tlsKey: './certs/key.pem',
      tlsCert: './certs/cert.pem',
    };

    this.database = {
      address: 'localhost:5432',
      database: 'datastation',
      username: 'datastation',
      password: '',
    };
  }
}

export async function readConfig(): Promise<Config> {
  const raw = fs.readFileSync(CONFIG_PATH);
  const rawJson = JSON.parse(raw.toString());
  const cfg = mergeDeep(new Config(), rawJson);

  const requiredFields = [
    'auth.sessionSecret',
    'auth.openId?.realm',
    'auth.openId?.clientId',
    'auth.openId?.clientSecret',
    'server.tlsKey',
    'server.tlsCert',
    'server.publicUrl',
    'database.address',
    'database.database',
  ];
  validate(cfg, requiredFields, (badKey) => {
    log.fatal(`'${badKey}' is a required field in config.json`);
  });

  return cfg;
}
