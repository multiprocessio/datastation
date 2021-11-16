import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import { App, init } from './app';
import log from './log';

process.on('unhandledRejection', (e) => {
  log.error(e);
  process.exit(1);
});
process.on('uncaughtException', (e) => {
  log.error(e);
});
log.info(APP_NAME, VERSION, DEBUG ? 'DEBUG' : '');

async function main() {
  const { app, handlers } = await init(App.make);
  await app.migrate();
  await app.serve(handlers);
}

main();
