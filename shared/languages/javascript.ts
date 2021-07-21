import circularSafeStringify from 'json-stringify-safe';

import { PanelResult } from '../state';
import { EOL } from './types';

function exceptionRewriter(msg: string, programPath: string) {
  const matcher = RegExp(`${programPath}:([1-9]*)`.replaceAll('/', '\\/'), 'g');

  return msg.replace(matcher, function (_: string, line: string) {
    return `${programPath}:${+line - preamble('', '').split(EOL).length}`;
  });
}

function defaultContent(panelIndex: number) {
  if (panelIndex === 0) {
    return 'DM_setPanel([])';
  }

  return `const previous = DM_getPanel(${
    panelIndex - 1
  });\nDM_setPanel(previous);`;
}

function preamble(outFile: string, resultsFile: string) {
  return `
function DM_getPanel(i) {
  const fs = require('fs');
  return JSON.parse(fs.readFileSync('${resultsFile}'))[i];
}
function DM_setPanel(v) {
  const fs = require('fs');
  fs.writeFileSync('${outFile}', JSON.stringify(v));
}`;
}

function inMemoryEval(
  prog: string,
  results: Array<PanelResult>
): Promise<[any, string]> {
  const anyWindow = window as any;
  // TODO: better deep copy
  anyWindow.DM_getPanel = (panelId: number) =>
    JSON.parse(JSON.stringify((results[panelId] || {}).value));

  const stdout: Array<string> = [];

  // TODO: sandbox
  return new Promise((resolve, reject) => {
    anyWindow.DM_setPanel = (v: any) => {
      resolve([v, stdout.join('\n')]);
    };
    const oldConsoleLog = console.log;
    console.log = (...n: Array<any>) =>
      stdout.push(n.map((v) => circularSafeStringify(v)).join(' '));
    try {
      eval(prog);
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
