import fs from 'fs/promises';
import Client from 'ssh2-sftp-client';
import { FilePanelInfo } from '../../shared/state';
import { parseArrayBuffer } from '../../shared/text';
import { Dispatch } from '../rpc';
import { additionalParsers } from './http';
import { getSSHConfig, resolvePath } from './tunnel';
import { EvalHandlerExtra, EvalHandlerResponse, guardPanel } from './types';

export async function evalFile(
  project: ProjectState,
  panel: PanelInfo,
  extra: EvalHandlerExtra,
  dispatch: Dispatch
): Promise<EvalHandlerResponse> {
  const {
    file: { contentTypeInfo, name },
    id,
    serverId,
  } = guardPanel<FilePanelInfo>(panel, 'file');
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
}
