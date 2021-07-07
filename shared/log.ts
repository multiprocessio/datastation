function log(level: string, ...args: any[]) {
  const f = level === 'ERROR' ? console.error : console.log;
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
