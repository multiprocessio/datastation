import '@datastation/shared/polyfill';
import 'source-map-support/register';
import { DSPROJ_FLAG, PANEL_FLAG, PANEL_META_FLAG } from './constants';
import { panelHandlers } from './panel';
import { openProjectHandler } from './project';
import { RPCHandler } from './rpc';
import { ensureSigningKey } from './secret';
import { loadSettings } from './settings';

export function initialize({
  runner,
  additionalHandlers,
}: {
  runner: string;
  additionalHandlers?: RPCHandler<any, any>[];
}) {
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

  ensureSigningKey();

  const settings = loadSettings();

  const handlers: RPCHandler<any, any>[] = [
    // Must come first so these can override defaults
    ...additionalHandlers,
    ...panelHandlers(runner),
    openProjectHandler,
    settings.getUpdateHandler(),
  ];

  return { settings, handlers, project, panel, panelMetaOut };
}
