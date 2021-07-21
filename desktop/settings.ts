import * as fs from 'fs/promises';

import * as uuid from 'uuid';

import { mergeDeep } from '../shared/merge';
import log from '../shared/log';

import { ensureFile } from './store';

export class LanguageSettings {
  path: string;

  constructor(path?: string) {
    this.path = path || '';
  }
}

export class LanguagesSettings {
  python: LanguageSettings;
  ruby: LanguageSettings;
  r: LanguageSettings;
  julia: LanguageSettings;
  javascript: LanguageSettings;

  constructor(
    python?: LanguageSettings,
    ruby?: LanguageSettings,
    r?: LanguageSettings,
    julia?: LanguageSettings,
    javascript?: LanguageSettings
  ) {
    this.python = python || new LanguageSettings();
    this.ruby = ruby || new LanguageSettings();
    this.julia = julia || new LanguageSettings();
    this.javascript = javascript || new LanguageSettings();
    this.r = r || new LanguageSettings();
  }
}

export class Settings {
  uid: string;
  lastProject?: string;
  languages: LanguagesSettings;
  file: string;
  stdoutMaxSize: number;

  constructor(
    file: string,
    uid?: string,
    lastProject?: string,
    languages?: LanguagesSettings,
    stdoutMaxSize?: number
  ) {
    this.uid = uid || uuid.v4();
    this.lastProject = lastProject || '';
    this.languages = languages || new LanguagesSettings();
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
