import { initialize as initializeBase, main } from '../desktop/runner';
import { App } from '../server/app';
import { readConfig } from '../server/config';
import { getProjectHandlers } from '../server/project';
import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import log from '../shared/log';

export function initialize(app: App, args: { subprocess: string }) {
  return initializeBase({
    ...args,
    additionalHandlers: getProjectHandlers(app),
  });
}

async function run() {
  const config = await readConfig();
  const app = new App(config);
  log.info(APP_NAME + ' Panel Runner', VERSION, DEBUG ? 'DEBUG' : '');
  await main(getProjectHandlers(app));
}

if ((process.argv[1] || '').includes('server_runner.js')) {
  run();
}
