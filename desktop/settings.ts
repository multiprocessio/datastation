import * as fs from 'fs/promises';

import * as uuid from 'uuid';

import { mergeDeep } from '../shared/merge';

import { ensureFile } from './store';

export class Settings {
  uid: string;
  lastProject?: string;
  file: string;

  constructor(file?: string, uid?: string, lastProject?: string) {
    this.uid = uid || uuid.v4();
    this.lastProject = lastProject;
    this.file = file;
  }

  static async fromFile(settingsFile: string) {
    const existingSettingsString = await fs.readFile(settingsFile);
    let existingSettings: Partial<Settings> = {
      file: settingsFile,
    };
    if (existingSettingsString) {
      try {
        existingSettings = JSON.parse(existingSettingsString.toString());
      } catch (e) {
        const backupFile = settingsFile + '.bak';
        console.error(
          `Settings file has been corrupted, renaming to ${backupFile}`,
          e
        );
        await fs.rename(settingsFile, backupFile);
      }
    }

    return mergeDeep(new Settings(), existingSettings);
  }

  save() {
    return fs.writeFile(this.file, JSON.stringify(this));
  }
}

export async function loadSettings(): Promise<Settings> {
  const settingsFile = '.settings';
  const fullName = await ensureFile(settingsFile);
  return await Settings.fromFile(fullName);
}
