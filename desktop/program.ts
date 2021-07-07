import { EOL } from 'os';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import util from 'util';

import { file as makeTmpFile } from 'tmp-promise';

import { ProgramPanelInfo } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';

import { DISK_ROOT, RESULTS_FILE } from './constants';
import { Settings } from './settings';

const execPromise = util.promisify(exec);

const JAVASCRIPT_PREAMBLE = (outFile: string) =>
  `
function DM_getPanel(i) {
  const fs = require('fs');
  return JSON.parse(fs.readFileSync('${RESULTS_FILE}'))[i];
}
function DM_setPanel(v) {
  const fs = require('fs');
  fs.writeFileSync('${outFile}', JSON.stringify(v));
}`;

const PYTHON_PREAMBLE = (outFile: string) => `
def DM_getPanel(i):
  import json
  with open(r'${RESULTS_FILE}') as f:
    return json.load(f)[i]
def DM_setPanel(v):
  import json
  with open(r'${outFile}', 'w') as f:
    json.dump(v, f)`;

const RUBY_PREAMBLE = (outFile: string) => `
def DM_getPanel(i)
  require 'json'
  JSON.parse(File.read('${RESULTS_FILE}'))[i]
end
def DM_setPanel(v)
  require 'json'
  File.write('${outFile}', v.to_json)
end`;

const JULIA_PREAMBLE = (outFile: string) => `
`;

const R_PREAMBLE = (outFile: string) => `
`;

const PREAMBLE = {
  javascript: JAVASCRIPT_PREAMBLE,
  python: PYTHON_PREAMBLE,
  ruby: RUBY_PREAMBLE,
  julia: JULIA_PREAMBLE,
  r: R_PREAMBLE,
};

export const getEvalProgramHandler = (settings: Settings) => ({
  resource: 'evalProgram',
  handler: async function (_: string, ppi: ProgramPanelInfo) {
    const programTmp = await makeTmpFile();
    const outputTmp = await makeTmpFile();

    const programPathOrName = {
      javascript: settings.nodePath,
      python: settings.pythonPath,
      ruby: settings.rubyPath,
      r: settings.rPath,
      julia: settings.juliaPath,
    }[ppi.program.type];

    let out = '';
    try {
      const preamble = PREAMBLE[ppi.program.type](outputTmp.path);
      await fs.writeFile(programTmp.path, [preamble, ppi.content].join(EOL));
      try {
        const { stdout, stderr } = await execPromise(
          `${programPathOrName} ${programTmp.path}`
        );
        out = stdout + stderr;
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
                +line - PYTHON_PREAMBLE('').split(EOL).length
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
                +line - JAVASCRIPT_PREAMBLE('').split(EOL).length
              }`;
            }
          );
        }

        e.stdout = out;
        throw e;
      }
    } finally {
      programTmp.cleanup();
      outputTmp.cleanup();
    }
  },
});
