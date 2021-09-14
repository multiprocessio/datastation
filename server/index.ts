import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import { init } from './app';
import log from './log';

process.on('unhandledRejection', (e) => {
  log.error(e);
  process.exit(1);
});
process.on('uncaughtException', (e) => {
  log.error(e);
});
log.info(APP_NAME, VERSION, DEBUG ? 'DEBUG' : '');

init();
