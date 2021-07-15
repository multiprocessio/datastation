import fs from 'fs/promises';

import Client from 'ssh2-sftp-client';
import fetch from 'node-fetch';

import { Proxy } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';

import { additionalParsers } from './http';
import { getSSHConfig, resolvePath } from './tunnel';

export const evalFileHandler = {
  resource: 'evalFile',
  handler: async function (
    _: string,
    { type, name, server }: Proxy<{ name: string; type: string }>
  ) {
    if (!server) {
      const body = await fs.readFile(resolvePath(name));
      return parseArrayBuffer('', name, body, additionalParsers);
    }

    const config = await getSSHConfig(server);

    const sftp = new Client();
    await sftp.connect(config);
    let body = (await sftp.get(name)) as ArrayBuffer;
    return await parseArrayBuffer(type, name, body, additionalParsers);
  },
};
