import { LanguageInfo } from './types';

import { JAVASCRIPT } from './javascript';
import { PYTHON } from './python';
import { RUBY } from './ruby';
import { JULIA } from './julia';
import { R } from './r';
import { SQL } from './sql';

export const LANGUAGES: Record<string, LanguageInfo> = {
  javascript: JAVASCRIPT,
  python: PYTHON,
  ruby: RUBY,
  julia: JULIA,
  r: R,
  sql: SQL,
};

export type SupportedLanguages = keyof typeof LANGUAGES;
