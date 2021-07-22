import * as fs from 'fs/promises';

import * as uuid from 'uuid';

import { mergeDeep } from '../shared/merge';
import log from '../shared/log';
import { LANGUAGES, SupportedLanguages } from '../shared/languages';

import { ensureFile } from './store';

export class LanguageSettings {
  path: string;

  constructor(path?: string) {
    this.path = path || '';
  }
}

export class Settings {
  uid: string;
  lastProject?: string;
  languages: Record<SupportedLanguages, LanguageSettings>;
  file: string;
  stdoutMaxSize: number;

  constructor(
    file: string,
    uid?: string,
    lastProject?: string,
    languages?: Record<SupportedLanguages, LanguageSettings>,
    stdoutMaxSize?: number
  ) {
    this.uid = uid || uuid.v4();
    this.lastProject = lastProject || '';
    this.languages =
      languages ||
      Object.keys(LANGUAGES).reduce(
        (agg, lang) => ({
          ...agg,
          [lang]: new LanguageSettings(),
        }),
        {}
      );
    this.stdoutMaxSize = stdoutMaxSize || 5000;
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

export let SETTINGS: Settings = null;

export async function loadSettings(): Promise<Settings> {
  const settingsFile = '.settings';
  const fullName = await ensureFile(settingsFile);
  SETTINGS = await Settings.fromFile(fullName);
  return SETTINGS;
}
