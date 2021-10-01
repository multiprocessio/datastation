import fs from 'fs';
import os from 'os';
import path from 'path';

// process.env.HOME is not set on Windows
export const HOME = os.homedir();

export const DISK_ROOT = path.join(HOME, 'DataStationProjects');

export const PROJECT_EXTENSION = 'dsproj';

export const DSPROJ_FLAG = '--dsproj';
export const PANEL_FLAG = '--evalPanel';
export const PANEL_META_FLAG = '--metaFile';

export const KEY_SIZE = 4096;

export const SYNC_PERIOD = 1000; // seconds

export const LOG_FILE = path.join(DISK_ROOT, 'log');

// Finds where package.json is in this repo, the repo root.
export const CODE_ROOT = (() => {
  for (let mpath of module.paths) {
    if (fs.existsSync(mpath)) {
      return path.dirname(mpath);
    }
  }

  return '';
})();
