import { EOL } from 'os';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import util from 'util';

import { file as makeTmpFile } from 'tmp-promise';

import { ProgramPanelInfo } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';

import { DISK_ROOT, RESULTS_FILE } from './constants';
import { Settings } from './settings';

const runningProcesses: Record<string, number> = {};

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
import JSON
function DM_getPanel(i)
  JSON.parsefile("${RESULTS_FILE}")[i+1]
end
function DM_setPanel(v)
  open("${outFile}", "w") do f
    JSON.print(f, v)
  end
end`;

const R_PREAMBLE = (outFile: string) => `
library("rjson")
DM_getPanel <- function(i) {
  fromJSON(file="${RESULTS_FILE}")[[i+1]]
}
DM_setPanel <- function(v) {
  write(toJSON(v), "${outFile}")
}`;

const PREAMBLE = {
  javascript: JAVASCRIPT_PREAMBLE,
  python: PYTHON_PREAMBLE,
  ruby: RUBY_PREAMBLE,
  julia: JULIA_PREAMBLE,
  r: R_PREAMBLE,
};

export const getProgramHandlers = (settings: Settings) => [
  {
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
          const child = spawn(programPathOrName, [programTmp.path]);
          // TODO: stream back
          let out = '';
          let stderr = '';
          child.stdout.on('data', (data) => {
            out += data;
          });

          child.stderr.on('data', (data) => {
            out += data;
            stderr += data;
          });

          runningProcesses[ppi.id] = child.pid;
          const code = await new Promise((resolve) =>
            child.on('close', resolve)
          );
          if (code !== 0) {
            throw Error(stderr);
          }

          const body = await fs.readFile(outputTmp.path);
          return [
            await parseArrayBuffer({ type: 'application/json' }, '', body),
            out,
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
              `${programTmp.path}:([1-9]*)`.replaceAll('/', '\\/'),
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
          } else if (ppi.program.type === 'julia') {
            const matcher = RegExp(
              `${programTmp.path}:([1-9]*)`.replaceAll('/', '\\/'),
              'g'
            );
            // Rewrite line numbers in traceback
            e.message = e.message.replace(
              matcher,
              function (_: string, line: string) {
                return `${programTmp.path}:${
                  +line - JULIA_PREAMBLE('').split(EOL).length
                }`;
              }
            );
          }

          e.stdout = out;
          throw e;
        }
      } finally {
        delete runningProcesses[ppi.id];
        programTmp.cleanup();
        outputTmp.cleanup();
      }
    },
  },
  {
    resource: 'killProcess',
    handler: async function (_: string, ppi: ProgramPanelInfo) {
      const pid = runningProcesses[ppi.id];
      if (pid) {
        process.kill(pid);
      }
    },
  },
];
