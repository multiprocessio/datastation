import { main as baseMain } from '../desktop/runner';
import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import log from '../shared/log';
import { App, init } from './app';
import { readConfig } from './config';

export async function main(app: App) {
  const { handlers } = await init(app, false);
  log.info(APP_NAME + ' Panel Runner', VERSION, DEBUG ? 'DEBUG' : '');
  await baseMain(handlers);
}

if ((process.argv[1] || '').includes('server_runner.js')) {
  main(App.make(readConfig()));
}
