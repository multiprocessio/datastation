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
      await fs.writeFile(
        projectResultsFile + body.id,
        JSON.stringify(res.value)
      );
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
