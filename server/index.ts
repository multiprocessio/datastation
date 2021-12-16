import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import { App, init } from './app';
import { readConfig } from './config';
import log from './log';

process.on('unhandledRejection', (e) => {
  log.error(e);
});
process.on('uncaughtException', (e) => {
  log.error(e);
});
log.info(APP_NAME, VERSION, DEBUG ? 'DEBUG' : '');

async function main() {
  const app = App.make(readConfig());
  const { handlers } = await init(app);
  await app.migrate();
  await app.serve(handlers);
}

main();
