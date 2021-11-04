import { preview } from '@multiprocess/preview';
import alasql from 'alasql';
import { v4 as uuidv4 } from 'uuid';
import { InvalidDependentPanelError } from '../errors';
import log from '../log';
import { PanelResult } from '../state';

function exceptionRewriter(msg: string, _: string) {
  return msg;
}

function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return 'SELECT NULL -- Your query here';
  }

  return `SELECT * FROM DM_getPanel(${panelIndex - 1})`;
}

function preamble(
  resultsFile: string,
  panelId: string,
  indexIdMap: Array<string>
) {
  return '';
}

async function inMemoryEval(
  prog: string,
  resultsOrDiskDetails:
    | Array<PanelResult>
    | { indexIdMap: Array<string>; resultsFile: string }
): Promise<{ value: any; preview: string; stdout: string }> {
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
    let res: any;
    if (Array.isArray(resultsOrDiskDetails)) {
      if (!resultsOrDiskDetails[n] || !resultsOrDiskDetails[n].value) {
        throw new InvalidDependentPanelError(n);
      }

      res = resultsOrDiskDetails[n].value;
    } else {
      const fs = require('fs');
      let f;
      try {
        f = fs.readFileSync(
          resultsOrDiskDetails.resultsFile + resultsOrDiskDetails.indexIdMap[n]
        );
      } catch (e) {
        log.error(e);
        throw new InvalidDependentPanelError(n);
      }
      res = JSON.parse(f.toString());
    }
    if (cb) {
      res = cb(res, idx, query);
    }
    return res;
  };
  fromAddons[thisDM_getPanel.toUpperCase()] = fromAddons[thisDM_getPanel];
  const patchedProgram = prog.replaceAll(/DM_getPanel/gi, thisDM_getPanel);

  try {
    // It is only asynchronous if you run "multiple" queries, so wrap
    // the one query in an array.
    const [value] = await alasql([patchedProgram]);
    return {
      value,
      preview: preview(value),
      stdout: '',
    };
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
