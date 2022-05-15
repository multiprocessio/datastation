export const SITE_ROOT = 'https://datastation.multiprocess.io';
export const CHAT_LINK = 'https://discord.gg/f2wQBc4bXX';

export const RPC_ASYNC_REQUEST = 'rpcAsyncRequest';
export const RPC_ASYNC_RESPONSE = 'rpcAsyncResponse';

function getConfig<T>(v: string, _default: T) {
  const key = 'DS_CONFIG_' + v;
  if (key in globalThis) {
    return (globalThis as any)[key] as T;
  }

  return _default;
}

export const DEBUG = getConfig<boolean>('DEBUG', true);
export const VERSION = getConfig<string>('VERSION', 'development');
export const MODE = getConfig<string>('MODE', 'browser');
export const APP_NAME = getConfig<string>('UI_TITLE', 'DataStation Desktop CE');

export const MODE_FEATURES = {
  appHeader: MODE !== 'desktop',
  connectors: MODE !== 'browser',
  sql: MODE !== 'browser',
  shareProject: MODE === 'browser',
  corsOnly: MODE === 'browser',
  noBodyYOverflow: MODE === 'desktop',
  storeResults: MODE !== 'browser',
  useDefaultProject: MODE === 'browser',
  extraLanguages: MODE !== 'browser',
  killProcess: MODE !== 'browser',
  dashboard: MODE === 'server',
  scheduledExports: MODE === 'server',
};

// There is no /docs/development/ so replace it with /docs/latest/
const DOCS_VERSION = VERSION === 'development' ? 'latest' : VERSION;
export const DOCS_ROOT = SITE_ROOT + '/docs/' + DOCS_VERSION;

export const IN_TESTS = globalThis.process
  ? process.env.JEST_WORKER_ID !== undefined
  : false;
