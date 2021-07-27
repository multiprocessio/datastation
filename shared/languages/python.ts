import circularSafeStringify from 'json-stringify-safe';
import { previewObject } from '../preview';
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
  indexIdMap: Record<number, string>
) {
  const file = ``;
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
    | { indexIdMap: Record<number, string>; resultsFile: string }
): Promise<{ value: any; preview: string; stdout: string }> {
  if (!Array.isArray(results)) {
    throw new Error(
      'Bad calling convention for in-memory panel. Expected full results object.'
    );
  }

  const anyWindow = window as any;

  // TODO: better deep copy
  anyWindow.DM_getPanel = (panelId: number) =>
    JSON.parse(JSON.stringify((results[panelId] || {}).value));

  const stdout: Array<string> = [];
  return new Promise((resolve, reject) => {
    function convertFromPyodideObjectIfNecessary(v: any) {
      return v.toJs ? v.toJs() : v;
    }

    anyWindow.DM_setPanel = (v: any) => {
      const value = convertFromPyodideObjectIfNecessary(v);
      resolve({
        value,
        preview: previewObject(value),
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
    return `, line ${
      +line - preamble('', '', {}).split(EOL).length
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
