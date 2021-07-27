import { spawn } from 'child_process';
import fs from 'fs/promises';
import { EOL } from 'os';
import { file as makeTmpFile } from 'tmp-promise';
import { RPC } from '../../shared/constants';
import { LANGUAGES } from '../../shared/languages';
import { ProgramPanelInfo } from '../../shared/state';
import { rpcEvalHandler } from './eval';
import { SETTINGS } from '../settings';
import { getProjectResultsFile } from '../store';

const runningProcesses: Record<string, Set<number>> = {};

function killAllByPanelId(panelId: string) {
  const pids = runningProcesses[panelId];
  if (pids) {
    Array.from(pids).map((pid) => process.kill(pid));
  }
}

export const evalProgramHandler = rpcEvalHandler<ProgramPanelInfo & { indexIdMap: Record<number, string>; }> ({
  resource: RPC.EVAL_PROGRAM,
  handler: async function(
    projectId: string,
    _: string,
    {
      indexIdMap,
      ...ppi,
    }: ProgramPanelInfo & {
      indexIdMap: Record<number, string>;
    }
  ) {
    const programTmp = await makeTmpFile();
    const language = LANGUAGES[ppi.program.type];

    const projectResultsFile = getProjectResultsFile(projectId);

    if (!language.defaultPath) {
      const res = await language.inMemoryEval(ppi.content, {
        resultsFile: projectResultsFile,
        indexIdMap,
      });

      return { value: res.value, stdout: res.stdout };
    }

    const programPathOrName =
      SETTINGS.languages[ppi.program.type].path || language.defaultPath;

    let out = '';
    let pid = 0;
    try {
      const preamble = language.preamble(
        projectResultsFile,
        ppi.id,
        indexIdMap
      );
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
        const code = await new Promise((resolve) => child.on('close', resolve));
        if (code !== 0) {
          throw Error(stderr);
        }

        const f = await fs.readFile(projectResultsFile + ppi.id);
        const value = JSON.parse(f.toString());

        return {
          skipWrite: true,
          value,
          stdout: out,
        };
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
});

export const programHandlers = [
  evalProgramHandler,
  {
    resource: RPC.KILL_PROCESS,
    handler: async function (_: string, _1: string, ppi: ProgramPanelInfo) {
      killAllByPanelId(ppi.id);
    },
  },
];
