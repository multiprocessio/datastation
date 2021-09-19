import fs from 'fs/promises';
import { EOL } from 'os';
import util from 'util';
import { logger } from '../shared/log';
import { LOG_FILE } from './constants';
import { ensureFile } from './fs';

export async function configureLogger() {
  await ensureFile(LOG_FILE);
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
