import fs from 'fs/promises';

import Client from 'ssh2-sftp-client';
import fetch from 'node-fetch';

import { Proxy } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';

import { additionalParsers } from './http';
import { getSSHConfig } from './tunnel';

export const evalFileHandler = {
  resource: 'evalFile',
  handler: async function (
    _: string,
    { name, server }: Proxy<{ name: string }>
  ) {
    if (!server) {
      const body = await fs.readFile(name);
      return parseArrayBuffer('text/plain', name, body, additionalParsers);
    }

    const config = await getSSHConfig(server);

    const sftp = new Client();
    await sftp.connect(config);
    let body = await sftp.get(name) as ArrayBuffer;
    return await parseArrayBuffer('text/plain', name, body, additionalParsers);
  },
};
