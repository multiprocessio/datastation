import * as fs from 'fs/promises';

import * as uuid from 'uuid';

import { mergeDeep } from '../shared/merge';
import log from '../shared/log';

import { ensureFile } from './store';

export class Settings {
  uid: string;
  lastProject?: string;
  pythonPath: string;
  nodePath: string;
  rPath: string;
  juliaPath: string;
  rubyPath: string;
  file: string;

  constructor(
    file: string,
    uid?: string,
    lastProject?: string,
    pythonPath?: string,
    nodePath?: string,
    rPath?: string,
    juliaPath?: string,
    rubyPath?: string
  ) {
    this.uid = uid || uuid.v4();
    this.lastProject = lastProject || '';
    this.pythonPath = pythonPath || 'python3';
    this.nodePath = nodePath || 'node';
    this.rPath = rPath || 'R';
    this.juliaPath = juliaPath || 'julia';
    this.rubyPath = rubyPath || 'ruby';
    this.file = file;
  }

  static async fromFile(settingsFile: string) {
    let existingSettingsString: Buffer | null = null;
    try {
      existingSettingsString = await fs.readFile(settingsFile);
    } catch (e) {
      // Fine if it doesn't exist
    }

    let existingSettings: Partial<Settings> = {
      file: settingsFile,
    };
    if (existingSettingsString) {
      try {
        existingSettings = JSON.parse(existingSettingsString.toString());
      } catch (e) {
        const backupFile = settingsFile + '.bak';
        log.error(
          `Settings file has been corrupted, renaming to ${backupFile}`,
          e
        );
        await fs.rename(settingsFile, backupFile);
      }
    }

    return mergeDeep(new Settings(settingsFile), existingSettings);
  }

  save() {
    return fs.writeFile(this.file, JSON.stringify(this));
  }

  getUpdateHandler() {
    return {
      resource: 'updateSettings',
      handler: (_: string, settings: Settings) => {
        this.lastProject = settings.lastProject;
        return this.save();
      },
    };
  }
}

export async function loadSettings(): Promise<Settings> {
  const settingsFile = '.settings';
  const fullName = await ensureFile(settingsFile);
  return await Settings.fromFile(fullName);
}
