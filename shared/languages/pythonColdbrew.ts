import { preview } from 'preview';
import { InvalidDependentPanelError, NoResultError } from '../errors';
import log from '../log';
import { deepClone, windowOrGlobal } from '../object';
import { PanelResult } from '../state';

import { PYTHON_PYODIDE } from './pythonPyodide';

function inMemoryInit() {
  const coldbrew = document.createElement('script');
  coldbrew.defer = true;
  coldbrew.src =
    'https://cdn.jsdelivr.net/gh/plasticityai/coldbrew@0.0.74/dist/coldbrew.js';

  return new Promise<void>((resolve, reject) => {
    try {
      coldbrew.onload = async function () {
        try {
          (window as any).coldbrew = await (window as any).Coldbrew.load();
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      document.body.appendChild(coldbrew);
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

    let returned = false;
    anyWindow.DM_setPanel = (v: any) => {
      const value = v;
      returned = true;
      resolve({
        value,
        preview: preview(value),
        stdout: stdout.join('\n'),
      });
    };
    anyWindow.DM_print = (...n: Array<any>) => stdout.push(n.join(' '));
    try {
      const fullProgram =
        'tojs = lambda a: a\nprint = lambda *args: Coldbrew.run_function("DM_print", *map(tojs, args))\nDM_getPanel = lambda *args: Coldbrew.run_function("DM_getPanel", *map(tojs, args))\nDM_setPanel = lambda *args: Coldbrew.run_function("DM_setPanel", *map(tojs, args))\n' +
        prog;
      anyWindow.Coldbrew.run(fullProgram);
      if (!returned) {
        throw new NoResultError();
      }
    } catch (e) {
      reject(e);
    }
  });
}

export const PYTHON_COLDBREW = {
  name: 'Python (coldbrew)',
  defaultPath: 'python3',
  defaultContent: PYTHON_PYODIDE.defaultContent,
  preamble: PYTHON_PYODIDE.preamble,
  inMemoryEval,
  inMemoryInit,
  exceptionRewriter: PYTHON_PYODIDE.exceptionRewriter,
};
