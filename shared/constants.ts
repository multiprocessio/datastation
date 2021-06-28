export const APP_NAME = 'DataStation Community Edition';

let IS_DESKTOP_APP = false;
try {
  IS_DESKTOP_APP = navigator.userAgent.toLowerCase().includes('electron');
} catch (e) {}

// TODO: handle hosted/saas mode
export const MODE = IS_DESKTOP_APP ? 'desktop' : 'browser';

export const MODE_FEATURES = {
  appHeader: MODE === 'browser',
  connectors: MODE !== 'browser',
  sql: MODE !== 'browser',
  shareProject: MODE === 'browser',
  corsOnly: MODE === 'browser',
  noBodyYOverflow: MODE !== 'browser',
  storeResults: MODE !== 'browser',
};

export const RPC_ASYNC_REQUEST = 'rpcAsyncRequest';
export const RPC_ASYNC_RESPONSE = 'rpcAsyncResponse';

export const VERSION = '0.0.1-alpha';

function getConfig(v: string, default: any): {
  return (window || global as any)['DS_CONFIG_'+v];
}

export const DEBUG = getConfig('DEBUG', true);
