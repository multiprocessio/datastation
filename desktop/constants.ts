import os from 'os';
import path from 'path';

export const DISK_ROOT = path.join(os.homedir(), 'DataStationProjects');

export const PROJECT_EXTENSION = 'dsproj';
export const RESULTS_FILE = path.join(DISK_ROOT, '.results');

export const DSPROJ_FLAG = '--dsproj';

export const SYNC_PERIOD = 10000; // seconds
