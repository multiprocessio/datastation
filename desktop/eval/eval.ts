import fs from 'fs/promises';
import jsesc from 'jsesc';
import { preview } from 'preview';
import { shape } from '../../shared/shape';
import { Proxy } from '../../shared/state';
import { getProjectResultsFile } from '../store';

type PanelProxy<T, S> = Proxy<T, S> & { id: string };

export function rpcEvalHandler<T, S>({
  resource,
  handler,
}: {
  resource: string;
  handler: (
    projectId: string,
    args: any,
    body: PanelProxy<T, S>
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
    body: PanelProxy<T, S>
  ): Promise<any> {
    const projectResultsFile = getProjectResultsFile(projectId);
    const res = await handler(projectId, args, body);
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
