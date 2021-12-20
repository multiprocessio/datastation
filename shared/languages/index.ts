import { JAVASCRIPT } from './javascript';
import { JULIA } from './julia';
import { PYTHON_PYODIDE } from './pythonPyodide';
import { PYTHON_COLDBREW } from './pythonColdbrew';
import { R } from './r';
import { RUBY } from './ruby';
import { SQL } from './sql';
import { LanguageInfo } from './types';

export const LANGUAGES: Record<string, LanguageInfo> = {
  javascript: JAVASCRIPT,
  pythonPyodide: PYTHON_PYODIDE,
  pythonColdbrew: PYTHON_COLDBREW,
  ruby: RUBY,
  julia: JULIA,
  r: R,
  sql: SQL,
};

export type SupportedLanguages = keyof typeof LANGUAGES;
