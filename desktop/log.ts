import fs from 'fs';
import { EOL } from 'os';
import util from 'util';
import { DEBUG } from '../shared/constants';
import { logger } from '../shared/log';
import { LOG_FILE } from './constants';
import { ensureFile } from './fs';

export function configureLogger() {
  ensureFile(LOG_FILE);
  const logFd = fs.openSync(LOG_FILE, 'a');

  logger.INFO = (...args: any[]) => {
    try {
      const msg = util.format(...args);
      if (DEBUG) {
        console.log(msg);
      }
      fs.appendFileSync(logFd, msg + EOL);
    } catch (e) {
      console.error(e);
      open();
    }
  };

  logger.ERROR = (...args: any[]) => {
    try {
      const e = new Error();
      const msg = util.format(...args) + EOL + e.stack;
      if (DEBUG) {
        console.log(msg);
      }
      fs.appendFileSync(logFd, msg + EOL);
    } catch (e) {
      console.error(e);
      open();
    }
  };
}
