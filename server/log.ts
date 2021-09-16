import log from '../shared/log';

export default {
  ...log,
  fatal: (...args: any[]) => {
    log.error(...args);
    process.exit(1);
  },
};
