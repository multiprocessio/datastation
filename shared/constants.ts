export const APP_NAME = 'datastation';

let IS_DESKTOP_APP = false;
try {
  IS_DESKTOP_APP = navigator.userAgent.toLowerCase().includes('electron');
} catch (e) {}

// TODO: handle hosted/saas mode
export const MODE = IS_DESKTOP_APP ? 'desktop' : 'demo';

export const MODE_FEATURES = {
  appHeader: MODE === 'demo',
  connectors: MODE !== 'demo',
  sql: MODE !== 'demo',
};

export const DEBUG = true;

export const RPC_ASYNC_REQUEST = 'rpcAsyncRequest';
export const RPC_ASYNC_RESPONSE = 'rpcAsyncResponse';
