import circularSafeStringify from 'json-stringify-safe';
import { preview } from 'preview';
import { InvalidDependentPanelError, NoResultError } from '../errors';
import log from '../log';
import { PanelResult } from '../state';
import { EOL } from './types';

function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return 'DM_setPanel([])';
  }

  return `previous = DM_getPanel(${panelIndex - 1});\nDM_setPanel(previous);`;
}

function preamble(
  resultsFile: string,
  panelId: string,
  indexIdMap: Array<string>
) {
  return `
def DM_getPanel(i):
  import json
  with open(r'${resultsFile}'+${JSON.stringify(indexIdMap)}[i]) as f:
    return json.load(f)
def DM_setPanel(v):
  import json
  with open(r'${resultsFile + panelId}', 'w') as f:
    json.dump(v, f)`;
}

function inMemoryEval(
  prog: string,
  results:
    | Array<PanelResult>
    | { indexIdMap: Array<string>; resultsFile: string }
): Promise<{ value: any; preview: string; stdout: string }> {
  if (!Array.isArray(results)) {
    // This is not a valid situation. Not sure how it could happen.
    throw new Error(
      'Bad calling convention for in-memory panel. Expected full results object.'
    );
  }

  const anyWindow = window as any;

  const stdout: Array<string> = [];
  return new Promise((resolve, reject) => {
    // TODO: better deep copy
    anyWindow.DM_getPanel = (panelId: number) => {
      if (!results[panelId]) {
        reject(new InvalidDependentPanelError(panelId));
        return;
      }

      try {
        return JSON.parse(JSON.stringify((results[panelId] || {}).value));
      } catch (e) {
        log.error(e);
        reject(new InvalidDependentPanelError(panelId));
      }
    };

    function convertFromPyodideObjectIfNecessary(v: any) {
      // Without dict_converter this objects in Python get converted to JavaScript Maps which cannot be stringified
      const jsValue = v && v.toJs ? v.toJs() : v;
      return jsValue;
    }

    let returned = false;
    anyWindow.DM_setPanel = (v: any) => {
      const value = convertFromPyodideObjectIfNecessary(v);
      returned = true;
      resolve({
        value,
        preview: preview(value),
        stdout: stdout.join('\n'),
      });
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
        'import pyodide\nimport js as window\ntojs = lambda a: pyodide.to_js(a, dict_converter=window.Object.fromEntries)\nprint = lambda *args: window.DM_print(*map(tojs, args))\nDM_getPanel = window.DM_getPanel\nDM_setPanel = lambda *args: window.DM_setPanel(*map(tojs, args))\n' +
        prog;
      anyWindow.pyodide.runPython(fullProgram);
      if (!returned) {
        throw new NoResultError();
      }
    } catch (e) {
      reject(e);
    }
  });
}

function exceptionRewriter(msg: string, _: string) {
  const matcher = /, line ([1-9]*), in <module>/g;

  return msg.replace(matcher, function (_: string, line: string) {
    return `, line ${
      +line - preamble('', '', []).split(EOL).length
    }, in <module>`;
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
