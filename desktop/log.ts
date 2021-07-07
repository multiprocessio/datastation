import { EOL } from 'os';
import fs from 'fs/promises';
import util from 'util';

import log, { logger } from '../shared/log';

import { LOG_FILE } from './constants';

export async function configureLogger() {
  let logFd: fs.FileHandle;
  async function open() {
    logFd = await fs.open(LOG_FILE, 'a');
  }
  await open();

  logger.INFO = (...args: any[]) => {
    try {
      logFd.appendFile(util.format(...args) + EOL);
    } catch (e) {
      console.error(e);
      open();
    }
  };

  logger.ERROR = (...args: any[]) => {
    try {
      const e = new Error();
      logFd.appendFile(util.format(...args) + EOL + e.stack + EOL);
    } catch (e) {
      console.error(e);
      open();
    }
  };
}
