import { LANGUAGES, SupportedLanguages } from './languages';
import { newId } from './object';

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
  autocompleteDisabled: boolean;
  theme: 'light' | 'dark';
  caCerts: Array<{ file: string; id: string }>;

  constructor(
    file: string,
    id?: string,
    lastProject?: string,
    languages?: Record<SupportedLanguages, LanguageSettings>,
    stdoutMaxSize?: number
  ) {
    this.id = id || newId();
    this.autocompleteDisabled = false;
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
    this.caCerts = [];
  }
}
