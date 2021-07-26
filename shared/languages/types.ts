import { PanelResult } from '../state';

export const EOL = /\r?\n/;

export interface LanguageInfo {
  name: string;
  defaultContent: (panelIndex: number) => string;
  preamble: (resultsFile: string, panelId: string, indexIdMap: Record<number,string>) => string;
  defaultPath: string;
  exceptionRewriter: (msg: string, programPath: string) => string;
  inMemoryEval?: (
    prog: string,
    results: Array<PanelResult>
  ) => Promise<{ stdout: string; preview: string; value: any }>;
}
