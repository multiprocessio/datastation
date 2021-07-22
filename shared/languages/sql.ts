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

async function inMemoryEval(
  prog: string,
  results: Array<PanelResult>
): Promise<[any, string]> {
  const thisDM_getPanel = 'DM_getPanel_' + uuidv4().replaceAll('-', '_');
  const fromAddons = (alasql as any).from;
  fromAddons[thisDM_getPanel] = function (
    n: number,
    opts: any,
    cb: any,
    idx: any,
    query: any
  ) {
    let res = results[n].value;
    if (cb) {
      res = cb(res, idx, query);
    }
    return res;
  };
  fromAddons[thisDM_getPanel.toUpperCase()] = fromAddons[thisDM_getPanel];
  const patchedProgram = prog.replaceAll(/DM_getPanel/gi, thisDM_getPanel);

  try {
    // It is only asynchronous if you run "multiple" queries.
    const [res] = await alasql([patchedProgram]);
    return [res, ''];
  } finally {
    delete fromAddons[thisDM_getPanel];
    delete fromAddons[thisDM_getPanel.toUpperCase()];
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
