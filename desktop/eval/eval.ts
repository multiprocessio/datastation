import fs from 'fs/promises';
import preview from 'preview';
import { shape } from '../../shared/shape';
import { Panel, Proxy } from '../../shared/state';
import { getProjectResultsFile } from './store';

type PanelProxy = Proxy & Panel;

export function rpcEvalHandler<T>({
  resource,
  handler,
}: {
  resource: string;
  handler: (
    projectId: string,
    args: any,
    body: PanelProxy<T>
  ) => Promise<{
    value: any;
    stdout?: string;
    skipWrite?: boolean;
  }>;
}) {
  const projectResultsFile = getProjectResultsFile(projectId);

  async function wrappedHandler(
    projectId: string,
    args: any,
    body: PanelProxy<T>
  ): Promise<any> {
    const res = await handler(projectId, args, body);
    if (!res.skipWrite) {
      await fs.writeFile(projectResultsFile + body.id);
    }

    return {
      ...res,
      stdout: res.stdout || '',
      preview: preview(res.value),
      shape: shape(res.value),
    };
  }

  return {
    resource,
    handler: wrappedHandler,
  };
}
