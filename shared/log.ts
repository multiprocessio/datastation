import { preview } from 'preview';
export const logger = {
  INFO: console.log,
  ERROR: console.trace,
};

function safePreview(o: any): string {
  try {
    return preview(o);
  } catch (e) {
    return String(o);
  }
}

function log(level: keyof typeof logger, ...args: any[]) {
  const stringArgs: Array<string> = [];
  let stackRecorded = '';
  for (const arg of args) {
    if (arg instanceof Error && !stackRecorded) {
      stackRecorded = arg.stack;
    }

    stringArgs.push(safePreview(arg));
  }
  if (stackRecorded) {
    stringArgs.push(safePreview(stackRecorded));
  }

  const f = logger[level];
  const now = new Date();
  f(`[${level}] ${now.toISOString()} ${stringArgs.join(' ')}`);
}

function info(...args: any[]) {
  log('INFO', ...args);
}

function error(...args: any[]) {
  log('ERROR', ...args);
}

export default {
  info,
  error,
};
