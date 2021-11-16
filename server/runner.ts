import { main as baseMain } from '../desktop/runner';
import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import log from '../shared/log';
import { App, AppFactory, init } from './app';

export async function main(appFactory: AppFactory) {
  const { handlers } = await init(appFactory);
  log.info(APP_NAME + ' Panel Runner', VERSION, DEBUG ? 'DEBUG' : '');
  await baseMain(handlers);
}

if ((process.argv[1] || '').includes('server_runner.js')) {
  main(App.make);
}
