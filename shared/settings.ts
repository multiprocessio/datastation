import * as uuid from 'uuid';
import { LANGUAGES, SupportedLanguages } from './languages';

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
  theme: 'light' | 'dark';

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
}
