import { logger } from '@datastation/shared/log';
import fs from 'fs';
import { EOL } from 'os';
import { LOG_FILE } from './constants';
import { ensureFile } from './fs';

export function configureLogger() {
  ensureFile(LOG_FILE);
  const logFd = fs.openSync(LOG_FILE, 'a');

  function makeLogger(log: (m: string) => void) {
    return (m: string) => {
      try {
        log(m);
        fs.appendFileSync(logFd, m + EOL);
      } catch (e) {
        console.error(e);
        open();
      }
    };
  }

  logger.INFO = makeLogger(console.log.bind(console));
  logger.ERROR = makeLogger(console.error.bind(console));
}
