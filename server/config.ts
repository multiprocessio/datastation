import fs from 'fs';
import yaml from 'js-yaml';
import { mergeDeep, validate } from '../shared/object';
import log from './log';

const CONFIG_PATH = '/etc/datastation/config.yaml';

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
      sessionSecret: 'datastation',
    };
    this.server = {
      port: 8080,
      address: 'localhost',
      publicUrl: 'http://localhost:8080',
    };

    this.database = {
      address: 'localhost:5432',
      database: 'datastation',
      username: 'datastation',
      password: 'datastation',
    };
  }
}

export function readConfig(): Config {
  const raw = fs.readFileSync(CONFIG_PATH);
  const rawYaml = yaml.load(raw.toString());

  const cfg = mergeDeep(new Config(), rawYaml);

  const requiredFields = [
    'auth.sessionSecret',
    'auth.openId?.realm',
    'auth.openId?.clientId',
    'auth.openId?.clientSecret',
    'server.publicUrl',
    'database.address',
    'database.database',
  ];
  validate(cfg, requiredFields, (badKey) => {
    log.fatal(`'${badKey}' is a required field in config.yaml`);
  });

  return cfg;
}
