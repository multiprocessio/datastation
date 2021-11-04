import { App } from '@datastation/server/app';
import { readConfig } from '@datastation/server/config';
import { getProjectHandlers } from '@datastation/server/project';
import { APP_NAME, DEBUG, VERSION } from '@datastation/shared/constants';
import log from '@datastation/shared/log';
import { main } from './desktop_runner';

async function run() {
  const config = await readConfig();
  const app = new App(config);
  log.info(APP_NAME + ' Panel Runner', VERSION, DEBUG ? 'DEBUG' : '');
  await main(getProjectHandlers(app));
}

if ((process.argv[1] || '').includes('server_runner.js')) {
  run();
}
