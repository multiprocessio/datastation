import fs from 'fs/promises';
import Client from 'ssh2-sftp-client';
import { Proxy } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';
import { additionalParsers } from './http';
import { getSSHConfig, resolvePath } from './tunnel';

export const evalFileHandler = {
  resource: 'evalFile',
  handler: async function (
    _: string,
    _1: string,
    {
      contentTypeInfo,
      name,
      server,
    }: Proxy<{
      name: string;
      contentTypeInfo: { type: string; customLineRegexp: string };
    }>
  ) {
    const typeInfo = { ...contentTypeInfo, additionalParsers };
    if (!server) {
      const body = await fs.readFile(resolvePath(name));
      return parseArrayBuffer(typeInfo, name, body);
    }

    const config = await getSSHConfig(server);

    const sftp = new Client();
    await sftp.connect(config);
    try {
      let body = (await sftp.get(name)) as ArrayBuffer;
      return await parseArrayBuffer(typeInfo, name, body);
    } finally {
      await sftp.end();
    }
  },
};
