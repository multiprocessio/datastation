import circularSafeStringify from 'json-stringify-safe';
import { preview } from 'preview';
import { InvalidDependentPanelError, NoResultError } from '../errors';
import log from '../log';
import { deepClone, windowOrGlobal } from '../object';
import { PanelResult } from '../state';
import { genericPreamble } from './javascript';
import python from './python.json';
import { EOL } from './types';

function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return 'result = []\n# Your logic here\nDM_setPanel(result)';
  }

  return `transform = DM_getPanel(${
    panelIndex - 1
  })\n# Your logic here\nDM_setPanel(transform)`;
}

function preamble(
  resultsFile: string,
  panelId: string,
  idMap: Record<string | number, string>
) {
  return genericPreamble(python.preamble, resultsFile, panelId, idMap);
}

function inMemoryInit() {
  const pyodide = document.createElement('script');
  pyodide.defer = true;
  pyodide.src = 'https://cdn.jsdelivr.net/pyodide/v0.18.0/full/pyodide.js';

  return new Promise<void>((resolve, reject) => {
    try {
      pyodide.onload = async function () {
        try {
          (window as any).pyodide = await (window as any).loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.18.0/full/',
          });
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      document.body.appendChild(pyodide);
    } catch (e) {
      reject(e);
    }
  });
}

function inMemoryEval(
  prog: string,
  results: Record<string | number, PanelResult>
): Promise<{ value: any; preview: string; stdout: string }> {
  const anyWindow = windowOrGlobal as any;

  const stdout: Array<string> = [];
  return new Promise((resolve, reject) => {
    anyWindow.DM_getPanel = (panelId: number) => {
      if (!results[panelId]) {
        reject(new InvalidDependentPanelError(panelId));
        return;
      }

      try {
        return deepClone((results[panelId] || {}).value);
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
      +line - preamble('', '', {}).split(EOL).length
    }, in <module>`;
  });
}

export const PYTHON = {
  name: python.name,
  defaultPath: python.defaultPath,
  defaultContent,
  preamble,
  inMemoryEval,
  inMemoryInit,
  exceptionRewriter,
};
