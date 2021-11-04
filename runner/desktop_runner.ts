import { IS_DESKTOP_RUNNER } from '@datastation/desktop/constants';
import { initialize } from '@datastation/desktop/initialize';
import { configureLogger } from '@datastation/desktop/log';
import { RPCHandler, RPCPayload } from '@datastation/desktop/rpc';
import { storeHandlers } from '@datastation/desktop/store';
import { APP_NAME, DEBUG, VERSION } from '@datastation/shared/constants';
import log from '@datastation/shared/log';
import '@datastation/shared/polyfill';
import fs from 'fs';
import 'source-map-support/register';
import { evalHandler } from './eval';

export async function main(additionalHandlers?: RPCHandler<any, any>[]) {
  // These throws are very important! Otherwise the runner will just hang.
  ['uncaughtException', 'unhandledRejection'].map((condition) => {
    process.on(condition, (e) => {
      log.error(e);
      process.exit(2);
    });
  });

  try {
    const { project, handlers, panel, panelMetaOut } = initialize({
      runner: '',
      additionalHandlers: [...(additionalHandlers || []), evalHandler],
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
    log.info(
      `Wrote panel meta for ${panel} of "${project}" to ${panelMetaOut}.`
    );

    // Must explicitly exit
    process.exit(0);
  } catch (e) {
    log.error(e);
    process.exit(2);
  }
}

if (IS_DESKTOP_RUNNER) {
  configureLogger();
  log.info(APP_NAME + ' Panel Runner', VERSION, DEBUG ? 'DEBUG' : '');

  main(storeHandlers);
}
