import circularSafeStringify from 'json-stringify-safe';
import { preview } from 'preview';
import { InvalidDependentPanelError, NoResultError } from '../errors';
import log from '../log';
import { deepClone, windowOrGlobal } from '../object';
import { PanelResult } from '../state';
import { EOL } from './types';

function exceptionRewriter(msg: string, programPath: string) {
  const matcher = RegExp(`${programPath}:([1-9]*)`.replaceAll('/', '\\/'), 'g');

  return msg.replace(matcher, function (_: string, line: string) {
    return `${programPath}:${+line - preamble('', '', []).split(EOL).length}`;
  });
}

function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return 'const result = [];\n// Your logic here\nDM_setPanel([]);';
  }

  return `const transform = DM_getPanel(${
    panelIndex - 1
  });\n// Your logic here\nDM_setPanel(transform);`;
}

function preamble(
  resultsFile: string,
  panelId: string,
  indexIdMap: Array<string>
) {
  return `
function DM_getPanel(i) {
  const fs = require('fs');
  return JSON.parse(fs.readFileSync('${resultsFile}'+${JSON.stringify(
    indexIdMap
  )}[i]));
}
function DM_setPanel(v) {
  const fs = require('fs');
  fs.writeFileSync('${resultsFile + panelId}', JSON.stringify(v));
}`;
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

  const anyWindow = windowOrGlobal as any;
  anyWindow.DM_getPanel = (panelId: number) => {
    if (!results[panelId]) {
      throw new InvalidDependentPanelError(panelId);
    }

    try {
      return deepClone((results[panelId] || {}).value);
    } catch (e) {
      log.error(e);
      throw new InvalidDependentPanelError(panelId);
    }
  };

  const stdout: Array<string> = [];

  // TODO: sandbox
  return new Promise((resolve, reject) => {
    let returned = false;
    anyWindow.DM_setPanel = (value: any) => {
      returned = true;
      resolve({
        value,
        preview: preview(value),
        stdout: stdout.join('\n'),
      });
    };
    const oldConsoleLog = console.log;
    console.log = (...n: Array<any>) =>
      stdout.push(n.map((v) => circularSafeStringify(v)).join(' '));
    try {
      eval(prog);
      if (!returned) {
        throw new NoResultError();
      }
    } catch (e) {
      reject(e);
    } finally {
      console.log = oldConsoleLog;
    }
  });
}

export const JAVASCRIPT = {
  name: 'JavaScript',
  defaultPath: 'node',
  defaultContent,
  preamble,
  inMemoryEval,
  exceptionRewriter,
};
