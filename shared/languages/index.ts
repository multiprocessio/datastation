import { JAVASCRIPT } from './javascript';
import { JULIA } from './julia';
import { PHP } from './php';
import { PYTHON } from './python';
import { R } from './r';
import { RUBY } from './ruby';
import { SQL } from './sql';
import { LanguageInfo } from './types';

export const LANGUAGES: Record<string, LanguageInfo> = {
  javascript: JAVASCRIPT,
  python: PYTHON,
  ruby: RUBY,
  julia: JULIA,
  r: R,
  sql: SQL,
  php: PHP,
  // TODO: get clojure working
  // clojure: CLOJURE,
};

export type SupportedLanguages = keyof typeof LANGUAGES;
