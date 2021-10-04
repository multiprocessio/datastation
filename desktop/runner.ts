import fs from 'fs';
import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import log from '../shared/log';
import '../shared/polyfill';
import { DSPROJ_FLAG, PANEL_FLAG, PANEL_META_FLAG } from './constants';
import { configureLogger } from './log';
import { panelHandlers } from './panel';
import { openProjectHandler } from './project';
import { RPCHandler, RPCPayload } from './rpc';
import { ensureSigningKey } from './secret';
import { loadSettings } from './settings';
import { storeHandlers } from './store';

export async function initialize({
  subprocess,
  additionalHandlers,
}: {
  subprocess?: string;
  additionalHandlers?: RPCHandler<any, any>[];
} = {}) {
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
    ...panelHandlers(subprocess),
    openProjectHandler,
    settings.getUpdateHandler(),
    ...additionalHandlers,
  ];

  return { settings, handlers, project, panel, panelMetaOut };
}

export async function main(additionalHandlers?: RPCHandler<any, any>[]) {
  // These throws are very important! Otherwise the runner will just hang.
  ['uncaughtException', 'unhandledRejection'].map((condition) => {
    process.on(condition, (e) => {
      console.error(e);
      process.exit(2);
    });
  });

  const { project, handlers, panel, panelMetaOut } = await initialize({
    additionalHandlers,
  });
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
  fs.writeFileSync(panelMetaOut, JSON.stringify(resultMeta));
  log.info(`Wrote panel meta for ${panel} of "${project}" to ${panelMetaOut}.`);

  // Must explicitly exit
  process.exit(0);
}

if (process.argv[1].includes('desktop_runner.js')) {
  configureLogger();
  log.info(APP_NAME + 'Panel Runner', VERSION, DEBUG ? 'DEBUG' : '');

  main(storeHandlers);
}
