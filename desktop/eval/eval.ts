import fs from 'fs/promises';
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
    if (!res.skipWrite) {
      // TODO: handle non-ascii better than this
      // Adapted from https://gist.github.com/mathiasbynens/1243213
      const json = JSON.stringify(res.value).replace(
        /[\s\S]/g,
        function (escape: string) {
          return '\\u' + ('0000' + escape.charCodeAt(0).toString(16).slice(-4));
        }
      );
      await fs.writeFile(projectResultsFile + body.id, json);
    }

    return {
      stdout: res.stdout || '',
      preview: preview(res.value),
      shape: shape(res.value),
      value: res.returnValue ? res.value : null,
    };
  }

  return {
    resource,
    handler: wrappedHandler,
  };
}
