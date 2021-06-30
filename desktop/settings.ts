import * as fs from 'fs/promises';

import * as uuid from 'uuid';

import { mergeDeep } from '../shared/merge';

import { ensureFile } from './store';

export class Settings {
  uid: string;
  lastProject?: string;
  file: string;

  constructor(file: string, uid?: string, lastProject?: string) {
    this.uid = uid || uuid.v4();
    this.lastProject = lastProject || '';
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
        console.error(
          `Settings file has been corrupted, renaming to ${backupFile}`,
          e
        );
        await fs.rename(settingsFile, backupFile);
      }
    }

    return mergeDeep(new Settings(settingsFile), existingSettings);
  }

  save() {
    console.log('Saving settings');
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
