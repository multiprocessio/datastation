import fs from 'fs';
import os from 'os';
import path from 'path';

// process.env.HOME is not set on Windows
export const HOME = os.homedir();

// This should be a const but this can actually change, only inside the runner code.
export const DISK_ROOT = { value: path.join(HOME, 'DataStationProjects') };

export const PROJECT_EXTENSION = 'dsproj';

export const DSPROJ_FLAG = '--dsproj';
export const PANEL_FLAG = '--evalPanel';
export const PANEL_META_FLAG = '--metaFile';
export const SETTINGS_FILE_FLAG = '--settingsFile';
export const FS_BASE_FLAG = '--fsbase';

export const KEY_SIZE = 4096;

export const LOG_FILE = path.join(DISK_ROOT.value, 'log');

// Finds where package.json is in this repo, the repo root.
export const CODE_ROOT = (() => {
  for (let mpath of module.paths) {
    if (fs.existsSync(mpath)) {
      return path.dirname(mpath);
    }
  }

  return '';
})();

export const IS_DESKTOP_RUNNER = (process.argv[1] || '').includes(
  'desktop_runner.js'
);
