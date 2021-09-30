import fs from 'fs/promises';
import { loadSettings } from '../desktop/settings';
import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import log from '../shared/log';
import { DSPROJ_FLAG, PANEL_FLAG, PANEL_META_FLAG } from './constants';
import { configureLogger } from './log';
import { panelHandlers } from './panel';
import { openProjectHandler } from './project';
import { RPCHandler } from './rpc';
import { ensureSigningKey } from './secret';
import { storeHandlers } from './store';

export async function initialize() {
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
    ...panelHandlers,
    openProjectHandler,
    settings.getUpdateHandler(),
  ];

  return { settings, handlers, project, panel, panelMetaOut };
}

async function main() {
  const { project, handlers, settings, panel, panelMetaOut } =
    await initialize();
  if (!project) {
    throw new Error('No project given.');
  }

  if (!panel) {
    throw new Error('No panel given.');
  }

  if (!panelMetaOut) {
    throw new Error('No panel meta out given.');
  }

  function dispatch(payload: RPCPayload, external = false) {
    const handler = handlers.filter((h) => h.resource === payload.resource)[0];
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
  console.log(
    `Wrote panel meta for ${panel} of "${project}" to ${panelMetaOut}.`
  );
}

if (require.main === module) {
  configureLogger().then(() => {
    log.info(APP_NAME, VERSION, DEBUG ? 'DEBUG' : '');
  });
  process.on('uncaughtException', (e) => {
    log.error(e);
  });

  main();
}
