import { preview } from 'preview';
import { Shape } from 'shape';
import { v4 as uuidv4 } from 'uuid';
import {
  InvalidDependentPanelError,
  NotAnArrayOfObjectsError,
} from '../errors';
import log from '../log';
import { PanelResult } from '../state';

function exceptionRewriter(msg: string, _: string) {
  return msg;
}

function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return "SELECT NULL AS 'NULL'";
  }

  return `SELECT * FROM DM_getPanel(${panelIndex - 1})`;
}

function preamble(
  resultsFile: string,
  panelId: string,
  idMap: Record<string | number, string>
) {
  return '';
}

function runSQL(prog: string, fetchResults: (n: string | number) => any[]) {
  // Functions like this can only be declared globally. So we make
  // sure DM_getPanel gets renamed to something unique so they don't
  // conflict if multiple run at the same time.
  const thisDM_getPanel = 'DM_getPanel_' + uuidv4().replaceAll('-', '_');
  const fromAddons = (window as any).alasql.from;
  fromAddons[thisDM_getPanel] = function (
    n: number,
    opts: any,
    cb: any,
    idx: any,
    query: any
  ) {
    let res = fetchResults(n);
    if (cb) {
      res = cb(res, idx, query);
    }
    return res;
  };
  fromAddons[thisDM_getPanel.toUpperCase()] = fromAddons[thisDM_getPanel];
  const patchedProgram = prog.replaceAll(/DM_getPanel/gi, thisDM_getPanel);

  try {
    const value = (window as any).alasql(patchedProgram);
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

function nodeEval(
  prog: string,
  results: {
    idMap: Record<string | number, string>;
    idShapeMap: Record<string | number, Shape>;
    resultsFile: string;
  }
) {
  return runSQL(prog, (n: string | number) => {
    const s = results.idShapeMap[n];
    if (!s || s.kind !== 'array') {
      throw new NotAnArrayOfObjectsError(n);
    }

    const fs = require('fs');
    let f;
    try {
      f = fs.readFileSync(results.resultsFile + results.idMap[n]);
    } catch (e) {
      log.error(e);
      throw new InvalidDependentPanelError(n);
    }
    return JSON.parse(f.toString());
  });
}

function inMemoryEval(
  prog: string,
  results: Record<string | number, PanelResult>
): Promise<{ value: any; preview: string; stdout: string }> {
  return Promise.resolve(
    runSQL(prog, (n: string | number) => {
      if (!results[n] || !results[n].value) {
        throw new InvalidDependentPanelError(n);
      }

      return results[n].value;
    })
  );
}

function inMemoryInit() {
  const scriptLoader = document.createElement('script');
  scriptLoader.src = 'https://cdn.jsdelivr.net/npm/alasql@1.7';

  return new Promise<void>((resolve, reject) => {
    try {
      scriptLoader.onload = function () {
        resolve();
      };

      document.head.appendChild(scriptLoader);
    } catch (e) {
      reject(e);
    }
  });
}

export const SQL = {
  name: 'SQL',
  defaultPath: '',
  defaultContent,
  preamble,
  inMemoryEval,
  inMemoryInit,
  exceptionRewriter,
  nodeEval,
};
