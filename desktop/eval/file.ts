import fs from 'fs/promises';
import Client from 'ssh2-sftp-client';
import { FilePanelInfo } from '../../shared/state';
import { parseArrayBuffer } from '../../shared/text';
import { Dispatch } from '../rpc';
import { rpcEvalHandler } from './eval';
import { additionalParsers } from './http';
import { getSSHConfig, resolvePath } from './tunnel';

export const evalFileHandler = rpcEvalHandler<FilePanelInfo>({
  resource: 'evalFile',
  handler: async function (
    projectId: string,
    _1: string,
    { file: { contentTypeInfo, name }, id, serverId }: FilePanelInfo,
    dispatch: Dispatch
  ) {
    const typeInfo = { ...contentTypeInfo, additionalParsers };
    if (!serverId) {
      const body = await fs.readFile(resolvePath(name));
      return await parseArrayBuffer(typeInfo, name, body);
    }

    const config = await getSSHConfig(dispatch, projectId, serverId);

    const sftp = new Client();
    await sftp.connect(config);
    try {
      const body = (await sftp.get(name)) as ArrayBuffer;
      return await parseArrayBuffer(typeInfo, name, body);
    } finally {
      await sftp.end();
    }
  },
});
