import log from '@datastation/shared/log';

export default {
  ...log,
  fatal: (...args: any[]) => {
    log.error(...args);
    process.exit(1);
  },
};
