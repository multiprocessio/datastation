import os from 'os';
import path from 'path';

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

export const DISK_ROOT = path.join(os.homedir(), '.datastation');

function getConfig<T>(v: string, _default: T) {
  const key = 'DS_CONFIG_' + v;
  let wg;
  try {
    wg = window as any;
  } catch (e) {
    wg = global as any;
  }
  if (key in wg) {
    return wg[key] as T;
  }

  return _default;
}

export const DEBUG = getConfig<Boolean>('DEBUG', true);
export const VERSION = getConfig<string>('VERSION', 'development');
