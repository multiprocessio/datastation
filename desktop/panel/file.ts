import fs from 'fs';
import Client from 'ssh2-sftp-client';
import { FilePanelInfo, PanelInfo, ProjectState } from '../../shared/state';
import { parseArrayBuffer } from '../../shared/text';
import { additionalParsers } from './parquet';
import { getSSHConfig, resolvePath } from './tunnel';
import { EvalHandlerResponse, guardPanel } from './types';

export async function evalFile(
  project: ProjectState,
  panel: PanelInfo
): Promise<EvalHandlerResponse> {
  const {
    file: { contentTypeInfo, name },
    serverId,
  } = guardPanel<FilePanelInfo>(panel, 'file');
  const typeInfo = { ...contentTypeInfo, additionalParsers };
  if (!serverId) {
    const body = fs.readFileSync(resolvePath(name));
    return await parseArrayBuffer(typeInfo, name, body);
  }

  const config = await getSSHConfig(project, serverId);

  const sftp = new Client();
  await sftp.connect(config);
  try {
    const body = (await sftp.get(name)) as ArrayBuffer;
    return await parseArrayBuffer(typeInfo, name, body);
  } finally {
    await sftp.end();
  }
}
