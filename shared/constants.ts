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
};

export const DEBUG = true;

export const RPC_ASYNC_REQUEST = 'rpcAsyncRequest';
export const RPC_ASYNC_RESPONSE = 'rpcAsyncResponse';
