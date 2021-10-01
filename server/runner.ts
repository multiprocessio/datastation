import fs from 'fs/promises';
import { DSPROJ_FLAG, PANEL_FLAG, PANEL_META_FLAG } from '../desktop/constants';
import { panelHandlers } from '../desktop/panel';
import { openProjectHandler } from '../desktop/project';
import { RPCHandler, RPCPayload } from '../desktop/rpc';
import { ensureSigningKey } from '../desktop/secret';
import { loadSettings } from '../desktop/settings';
import { storeHandlers } from '../desktop/store';
import log from '../shared/log';

export async function initialize({ subprocess }: { subprocess?: string } = {}) {
  let project = '';
  let panel = '';
  let panelMetaOut = '';
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === DSPROJ_FLAG) {
      project = process.argv[i + 1];
      continue;
    }

    if (process.argv[i] === PANEL_FLAG) {
      panel = process.argv[i + 1];
      continue;
    }

    if (process.argv[i] === PANEL_META_FLAG) {
      panelMetaOut = process.argv[i + 1];
      continue;
    }
  }

  await ensureSigningKey();

  const settings = await loadSettings();

  const handlers: RPCHandler<any, any>[] = [
    ...storeHandlers,
    ...panelHandlers(subprocess),
    openProjectHandler,
    settings.getUpdateHandler(),
  ];

  return { settings, handlers, project, panel, panelMetaOut };
}

async function main() {
  const { project, handlers, panel, panelMetaOut } = await initialize();
  if (!project) {
    throw new Error('No project given.');
  }

  if (!panel) {
    throw new Error('No panel given.');
  }

  if (!panelMetaOut) {
    throw new Error('No panel meta out given.');
  }

  function dispatch(
    payload: Omit<RPCPayload, 'messageNumber'>,
    external = false
  ) {
    const handler = handlers.find((h) => h.resource === payload.resource);
    if (!handler) {
      throw new Error(`No RPC handler for resource: ${payload.resource}`);
    }

    return handler.handler(payload.projectId, payload.body, dispatch, false);
  }

  const resultMeta = await dispatch({
    resource: 'eval',
    body: { panelId: panel },
    projectId: project,
  });
  await fs.writeFile(panelMetaOut, resultMeta);
  log.info(`Wrote panel meta for ${panel} of "${project}" to ${panelMetaOut}.`);
}

if (require.main === module) {
  process.on('uncaughtException', (e) => {
    log.error(e);
  });

  main();
}
