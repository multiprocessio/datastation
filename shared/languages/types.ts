import { PanelResult } from '../state';

export const EOL = /\r?\n/;

export interface LanguageInfo {
  name: string;
  defaultContent: (panelIndex: number) => string;
  preamble: (
    resultsFile: string,
    panelId: string,
    idMap: Record<number | string, string>
  ) => string;
  defaultPath: string;
  exceptionRewriter: (msg: string, programPath: string) => string;
  inMemoryInit?: () => Promise<void>;
  inMemoryEval?: (
    prog: string,
    resultsOrDiskDetails:
      | Record<string | number, PanelResult>
      | { idMap: Record<string | number, string>; resultsFile: string }
  ) => Promise<{ stdout: string; preview: string; value: any }>;
}
