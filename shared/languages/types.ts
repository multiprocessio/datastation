import { Shape } from 'shape';
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
    results: Record<string | number, PanelResult>
  ) => Promise<{ stdout: string; preview: string; value: any }>;
  nodeEval?: (
    prog: string,
    results: {
      idMap: Record<string | number, string>;
      idShapeMap: Record<string | number, Shape>;
      resultsFile: string;
    }
  ) => { stdout: string; preview: string; value: any };
}
