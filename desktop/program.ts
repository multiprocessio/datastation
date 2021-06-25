import fs from 'fs/promises';
import util from 'util';
import { exec } from 'child_process';

import { file as makeTmpFile } from 'tmp-promise';

import { ProgramPanelInfo, PanelResults } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';

const execPromise = util.promisify(exec);

let TMP_RESULTS_FILE = '.results';
const JAVASCRIPT_PREAMBLE = (outFile: string) =>
  `
const fs = require('fs');
global.cache = {};
function DM_getPanel(i) {
  if (global.cache[i]) {
    return global.cache[i];
  }
 
  global.cache[i] = JSON.parse(fs.readFileSync('${TMP_RESULTS_FILE}'));
  return global.cache[i];
}
function DM_setPanel(v) {
  fs.writeFileSync('${outFile}', JSON.stringify(v));
}`
    .replace('\n', ' ')
    .replace('  ', '');

const PYTHON_PREAMBLE = (outFile: string) => `
import json as __DM_JSON
__GLOBAL = {}
def DM_getPanel(i):
  if i in __GLOBAL: return __GLOBAL[i]
  with open('${TMP_RESULTS_FILE}') as f:
    __GLOBAL[i] = __DM_JSON.load(f)
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
  handler: function (_: string, results: PanelResults) {
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
      const { stdout, stderr } = await execPromise(
        `${runtime} ${programTmp.path}`
      );
      const body = await fs.readFile(outputTmp.path);
      return [
        await parseArrayBuffer('application/json', '', body),
        stdout + stderr,
      ];
    } finally {
      programTmp.cleanup();
      outputTmp.cleanup();
    }
  },
};

export const programHandlers = [storeResultsHandler, evalProgramHandler];
