import fs from 'fs/promises';
import { mergeDeep, validate } from '../shared/object';
import log from './log';

const CONFIG_PATH = '/usr/local/datastation/config.json';

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

  constructor() {
    this.auth = {
      sessionSecret: '',
    };
    this.server = {
      port: 8080,
      address: 'localhost',
      publicUrl: 'https://localhost:8080',
      tlsKey: './certs/cert.pem',
      tlsCert: './certs/key.pem',
    };
  }
}

export async function readConfig(): Promise<Config> {
  const raw = await fs.readFile(CONFIG_PATH);
  const rawJson = JSON.parse(raw.toString());
  const cfg = mergeDeep(new Config(), rawJson);

  const requiredFields = [
    'auth.sessionSecret',
    'server.tlsKey',
    'server.tlsCert',
    'server.publicUrl',
  ];
  validate(cfg, requiredFields, (badKey) => {
    log.fatal(`'${badKey}' is a required field in config.json`);
  });

  return cfg;
}
