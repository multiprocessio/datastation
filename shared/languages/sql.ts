import { v4 as uuidv4 } from 'uuid';
import alasql from 'alasql';
import circularSafeStringify from 'json-stringify-safe';

import { PanelResult } from '../state';
import { EOL } from './types';

function exceptionRewriter(msg: string, _: string) {
  return msg;
}

function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return '';
  }

  return `SELECT * FROM DM_getPanel(${panelIndex - 1})`;
}

function preamble(outFile: string, resultsFile: string) {
  return '';
}

function inMemoryEval(
  prog: string,
  results: Array<PanelResult>
): Promise<[any, string]> {
  const thisDM_getPanel = 'DM_getPanel' + uuidv4();
  const fromAddons = (alasql as any).from;
  fromAddons[thisDM_getPanel] = function (n: number) {
    return results[n];
  };

  try {
    return alasql(prog);
  } finally {
    delete fromAddons[thisDM_getPanel];
  }
}

export const SQL = {
  name: 'SQL',
  defaultPath: '',
  defaultContent,
  preamble,
  inMemoryEval,
  exceptionRewriter,
};
