import fs from 'fs/promises';
import util from 'util';
import { exec } from 'child_process';

import { file as makeTmpFile } from 'tmp-promise';

import { ProgramPanelInfo } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';

const execPromise = util.promisify(exec);

let TMP_RESULTS_FILE = '.results';
const JAVASCRIPT_PREAMBLE = (outFile: string) =>
  `
const fs = require('fs');
global.cache = null;
function DM_getPanel(i) {
  if (global.cache) {
    return global.cache[i];
  }
 
  global.cache = JSON.parse(fs.readFileSync('${TMP_RESULTS_FILE}'));
  if (!global.cache) {
    return [];
  }
  return global.cache[i];
}
function DM_setPanel(v) {
  fs.writeFileSync('${outFile}', JSON.stringify(v));
}`
    .replace('\n', ' ')
    .replace('  ', '');

const PYTHON_PREAMBLE = (outFile: string) => `
import json as __DM_JSON
__GLOBAL = None
def DM_getPanel(i):
  global __GLOBAL
  if __GLOBAL: return __GLOBAL[i]
  with open('${TMP_RESULTS_FILE}') as f:
    __GLOBAL = __DM_JSON.load(f)
  if not __GLOBAL: return []
  return __GLOBAL[i]
def DM_setPanel(v):
  with open('${outFile}', 'w') as f:
    __DM_JSON.dump(v, f)`;

const PREAMBLE = {
  javascript: JAVASCRIPT_PREAMBLE,
  python: PYTHON_PREAMBLE,
};

export const storeResultsHandler = {
  resource: 'storeResults',
  handler: function (_: string, results: any) {
    if (!results) {
      return;
    }
    return fs.writeFile(TMP_RESULTS_FILE, JSON.stringify(results));
  },
};

export const evalProgramHandler = {
  resource: 'evalProgram',
  handler: async function (_: string, ppi: ProgramPanelInfo) {
    if (!TMP_RESULTS_FILE) {
      return [];
    }

    const programTmp = await makeTmpFile();
    const outputTmp = await makeTmpFile();

    try {
      const preamble = PREAMBLE[ppi.program.type](outputTmp.path);
      await fs.writeFile(programTmp.path, [preamble, ppi.content].join('\n'));
      const runtime = ppi.program.type === 'javascript' ? 'node' : 'python3';
      try {
        const { stdout, stderr } = await execPromise(
          `${runtime} ${programTmp.path}`
        );
        const body = await fs.readFile(outputTmp.path);
        return [
          await parseArrayBuffer('application/json', '', body),
          stdout + stderr,
        ];
      } catch (e) {
        if (ppi.program.type === 'python') {
          const matcher = /, line ([1-9]*), in <module>/g;
          // Rewrite line numbers in traceback
          e.message = e.message.replace(
            matcher,
            function (_: string, line: string) {
              return `, line ${
                +line - PYTHON_PREAMBLE('').split('\n').length
              }, in <module>`;
            }
          );
        } else if (ppi.program.type === 'javascript') {
          const matcher = RegExp(
            `${programTmp.path}:([1-9]*)`.replace('/', '\\/'),
            'g'
          );
          // Rewrite line numbers in traceback
          e.message = e.message.replace(
            matcher,
            function (_: string, line: string) {
              return `${programTmp.path}:${
                +line - JAVASCRIPT_PREAMBLE('').split('\n').length
              }`;
            }
          );
        }

        throw e;
      }
    } finally {
      programTmp.cleanup();
      outputTmp.cleanup();
    }
  },
};

export const programHandlers = [storeResultsHandler, evalProgramHandler];
