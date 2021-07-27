import fs from 'fs/promises';
import Client from 'ssh2-sftp-client';
import { FilePanelInfo, Proxy } from '../../shared/state';
import { parseArrayBuffer } from '../../shared/text';
import { rpcEvalHandler } from './eval';
import { additionalParsers } from './http';
import { getSSHConfig, resolvePath } from './tunnel';

export const evalFileHandler = rpcEvalHandler<FilePanelInfo, void>({
  resource: 'evalFile',
  handler: async function (
    _: string,
    _1: string,
    { file: { contentTypeInfo, name }, id, server }: Proxy<FilePanelInfo, void>
  ) {
    const typeInfo = { ...contentTypeInfo, additionalParsers };
    if (!server) {
      const body = await fs.readFile(resolvePath(name));
      const value = parseArrayBuffer(typeInfo, name, body);
      return { value };
    }

    const config = await getSSHConfig(server);

    const sftp = new Client();
    await sftp.connect(config);
    try {
      const body = (await sftp.get(name)) as ArrayBuffer;
      const value = await parseArrayBuffer(typeInfo, name, body);
      return { value };
    } finally {
      await sftp.end();
    }
  },
});
