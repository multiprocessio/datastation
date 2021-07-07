function log(level: string, ...args: any[]) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] instanceof Error) {
      args[i] = args[i].stack;
    }
  }
  const f = level === 'ERROR' ? console.trace : console.log;
  f(`[${level}] ${new Date()} ${args.map(String).join(' ')}`);
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
