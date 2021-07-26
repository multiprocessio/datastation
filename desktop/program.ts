import { spawn } from 'child_process';
import fs from 'fs/promises';
import { EOL } from 'os';
import { file as makeTmpFile } from 'tmp-promise';
import { LANGUAGES } from '../shared/languages';
import { PanelResult, ProgramPanelInfo } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';
import {previewObject } from '../shared/preview';
import {RPC} from '../shared/constants';
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
    resource: RPC.EVAL_PROGRAM,
    handler: async function (
      projectId: string,
      _: string,
      ppi: ProgramPanelInfo,
      indexIdMap: Record<number, string>,
    ) {
      const programTmp = await makeTmpFile();
      const language = LANGUAGES[ppi.program.type];

      const projectResultsFile = getProjectResultsFile(projectId);

      if (!language.defaultPath) {
        return language.inMemoryEval(ppi.content, projectResultsFile, indexIdMap);
      }

      const programPathOrName =
        SETTINGS.languages[ppi.program.type].path || language.defaultPath;

      let out = '';
      let pid = 0;
      try {
        const preamble = language.preamble(projectResultsFile, panelIndex, indexIdMap);
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

          return {
            value: '',
            preview: objectPreview(value)
            stdout: out,
          }
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
      }
    },
  },
  {
    resource: RPC.KILL_PROCESS,
    handler: async function (_: string, _1: string, ppi: ProgramPanelInfo) {
      killAllByPanelId(ppi.id);
    },
  },
];
