import circularSafeStringify from 'json-stringify-safe';

import { PanelResult } from '../state';
import { EOL } from './types';

function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return 'DM_setPanel([])';
  }

  return `previous = DM_getPanel(${panelIndex - 1});\nDM_setPanel(previous);`;
}

function preamble(outFile: string, resultsFile: string) {
  return `
def DM_getPanel(i):
  import json
  with open(r'${resultsFile}') as f:
    return json.load(f)[i]
def DM_setPanel(v):
  import json
  with open(r'${outFile}', 'w') as f:
    json.dump(v, f)`;
}

function inMemoryEval(
  prog: string,
  results: Array<PanelResult>
): Promise<[any, string]> {
  const anyWindow = window as any;

  // TODO: better deep copy
  anyWindow.DM_getPanel = (panelId: number) => {
    console.log(panelId, results[panelId]);
    return JSON.parse(JSON.stringify((results[panelId] || {}).value));
  };

  const stdout: Array<string> = [];
  return new Promise((resolve, reject) => {
    function convertFromPyodideObjectIfNecessary(v: any) {
      return v.toJs ? v.toJs() : v;
    }

    anyWindow.DM_setPanel = (v: any) => {
      resolve([convertFromPyodideObjectIfNecessary(v), stdout.join('\n')]);
    };
    anyWindow.DM_print = (...n: Array<any>) =>
      stdout.push(
        n
          .map((v) =>
            circularSafeStringify(convertFromPyodideObjectIfNecessary(v))
          )
          .join(' ')
      );
    try {
      const fullProgram =
        'import js as window\nprint = lambda *args: window.DM_print(*args)\nDM_getPanel = window.DM_getPanel\nDM_setPanel = window.DM_setPanel\n' +
        prog;
      anyWindow.pyodide.runPython(fullProgram);
    } catch (e) {
      reject(e);
    }
  });
}

function exceptionRewriter(msg: string, _: string) {
  const matcher = /, line ([1-9]*), in <module>/g;

  return msg.replace(matcher, function (_: string, line: string) {
    return `, line ${+line - preamble('', '').split(EOL).length}, in <module>`;
  });
}

export const PYTHON = {
  name: 'Python',
  defaultPath: 'python3',
  defaultContent,
  preamble,
  inMemoryEval,
  exceptionRewriter,
};
