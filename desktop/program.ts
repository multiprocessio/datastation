import { EOL } from 'os';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import util from 'util';

import { file as makeTmpFile } from 'tmp-promise';

import { LANGUAGES } from '../shared/languages';
import { ProgramPanelInfo, PanelResult } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';

import { DISK_ROOT } from './constants';
import { SETTINGS } from './settings';
import { getProjectResultsFile } from './store';

const runningProcesses: Record<string, Set<number>> = {};

function killAllByPanelId(panelId: string) {
  const pids = runningProcesses[panelId];
  if (pids) {
    Array.from(pids).map((pid) => process.kill(pid));
  }
}

export const programHandlers = [
  {
    resource: 'evalProgram',
    handler: async function (
      projectId: string,
      _: string,
      ppi: ProgramPanelInfo
    ) {
      const programTmp = await makeTmpFile();
      const outputTmp = await makeTmpFile();
      const language = LANGUAGES[ppi.program.type];

      const projectResultsFile = getProjectResultsFile(projectId);

      if (!language.defaultPath) {
        const results: Array<PanelResult> = JSON.parse(await fs.readFile(projectResultsFile).toString());
        return language.inMemoryEval(ppi.content, results);
      }

      const programPathOrName =
        SETTINGS.languages[ppi.program.type].path || language.defaultPath;

      let out = '';
      let pid = 0;
      try {
        const preamble = language.preamble(outputTmp.path, projectResultsFile);
        await fs.writeFile(programTmp.path, [preamble, ppi.content].join(EOL));
        try {
          const child = spawn(programPathOrName, [programTmp.path]);
          // TODO: stream back
          let out = '';
          let stderr = '';
          let truncated = false;
          child.stdout.on('data', (data) => {
            if (out.length > SETTINGS.stdoutMaxSize && !truncated) {
              out += '[TRUNCATED]';
              truncated = true;
            }

            if (!truncated) {
              out += data;
            }
          });

          child.stderr.on('data', (data) => {
            if (out.length > SETTINGS.stdoutMaxSize && !truncated) {
              out += '[TRUNCATED]';
              truncated = true;
            }

            if (!truncated) {
              out += data;
              stderr += data;
            }
          });

          killAllByPanelId(ppi.id);
          if (!runningProcesses[ppi.id]) {
            runningProcesses[ppi.id] = new Set();
          }
          pid = child.pid;
          runningProcesses[ppi.id].add(child.pid);
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
          e.message = language.exceptionRewriter(e.message, programTmp.path);
          e.stdout = out;
          throw e;
        }
      } finally {
        if (pid) {
          runningProcesses[ppi.id].delete(pid);
        }
        programTmp.cleanup();
        outputTmp.cleanup();
      }
    },
  },
  {
    resource: 'killProcess',
    handler: async function (_: string, _1: string, ppi: ProgramPanelInfo) {
      killAllByPanelId(ppi.id);
    },
  },
];
