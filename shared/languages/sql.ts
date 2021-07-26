import alasql from 'alasql';
import { v4 as uuidv4 } from 'uuid';
import { previewObject } from '../preview';
import { PanelResult } from '../state';

function exceptionRewriter(msg: string, _: string) {
  return msg;
}

function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return '';
  }

  return `SELECT * FROM DM_getPanel(${panelIndex - 1})`;
}

function preamble(resultsFile: string, panelId: string, indexIdMap: Record<number, string>) {
  return '';
}

async function inMemoryEval(
  prog: string,
  results: Array<PanelResult>
): Promise<{ value: any; preview: string; }> {
  // Functions like this can only be declared globally. So we make sure DM_getPanel gets renamed to something unique
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
    const [value] = await alasql([patchedProgram]);
    return {
      value,
      preview: previewObject(value),
    }
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
