import fs from 'fs/promises';
import jsesc from 'jsesc';
import { preview } from 'preview';
import { shape } from 'shape';
import { Dispatch } from '../rpc';
import { getProjectResultsFile } from '../store';

interface Body {
  id: string;
}

export function rpcEvalHandler<T extends Body>({
  resource,
  handler,
}: {
  resource: string;
  handler: (
    projectId: string,
    args: any,
    body: T,
    dispatch: Dispatch
  ) => Promise<{
    value: any;
    contentType?: string;
    stdout?: string;
    skipWrite?: boolean;
    returnValue?: boolean;
  }>;
}) {
  async function wrappedHandler(
    projectId: string,
    args: any,
    body: T,
    dispatch: Dispatch
  ): Promise<any> {
    const projectResultsFile = getProjectResultsFile(projectId);
    const res = await handler(projectId, args, body, dispatch);
    const json = jsesc(res.value, { quotes: 'double', json: true });
    // TODO: is it a problem panels like Program skip this escaping?
    if (!res.skipWrite) {
      await fs.writeFile(projectResultsFile + body.id, json);
    }

    return {
      stdout: res.stdout || '',
      preview: preview(res.value),
      shape: shape(res.value),
      value: res.returnValue ? res.value : null,
      size: json.length,
      contentType: res.contentType || 'application/json',
    };
  }

  return {
    resource,
    handler: wrappedHandler,
  };
}
