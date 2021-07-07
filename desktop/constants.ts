import os from 'os';
import path from 'path';

// process.env.HOME is not set on Windows
export const HOME = os.homedir();

export const DISK_ROOT = path.join(HOME, 'DataStationProjects');

export const PROJECT_EXTENSION = 'dsproj';
export const RESULTS_FILE = path.join(DISK_ROOT, '.results');

export const DSPROJ_FLAG = '--dsproj';

export const SYNC_PERIOD = 10000; // seconds
