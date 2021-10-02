import * as fs from 'fs/promises';
import * as uuid from 'uuid';
import { LANGUAGES, SupportedLanguages } from '../shared/languages';
import log from '../shared/log';
import { mergeDeep } from '../shared/object';
import { ensureFile } from './fs';
import { RPCHandler } from './rpc';

export class LanguageSettings {
  path: string;

  constructor(path?: string) {
    this.path = path || '';
  }
}

export class Settings {
  id: string;
  lastProject?: string;
  languages: Record<SupportedLanguages, LanguageSettings>;
  file: string;
  stdoutMaxSize: number;

  constructor(
    file: string,
    id?: string,
    lastProject?: string,
    languages?: Record<SupportedLanguages, LanguageSettings>,
    stdoutMaxSize?: number
  ) {
    this.id = id || uuid.v4();
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
    let s: string = '';
    if (existingSettingsString && (s = existingSettingsString.toString())) {
      try {
        existingSettings = JSON.parse(s);
        // Migrate from .uid to .id
        if ((existingSettings as any).uid) {
          existingSettings.id = (existingSettings as any).uid;
          delete (existingSettings as any).uid;
        }
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

  async save() {
    return await fs.writeFile(this.file, JSON.stringify(this));
  }

  getUpdateHandler(): RPCHandler<Settings, void> {
    return {
      resource: 'updateSettings',
      handler: (_: string, settings: Settings) => {
        this.lastProject = settings.lastProject;
        return this.save();
      },
    };
  }
}

export let SETTINGS: Settings = new Settings('');

export async function loadSettings(settingsFile?: string): Promise<Settings> {
  if (!settingsFile) {
    settingsFile = '.settings';
  }
  const fullName = await ensureFile(settingsFile);
  SETTINGS = await Settings.fromFile(fullName);
  return SETTINGS;
}
