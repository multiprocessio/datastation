import { spawn } from 'child_process';
import fs from 'fs/promises';
import { EOL } from 'os';
import path from 'path';
import { file as makeTmpFile } from 'tmp-promise';
import { InvalidDependentPanelError, NoResultError } from '../../shared/errors';
import { LANGUAGES } from '../../shared/languages';
import { PanelBody } from '../../shared/rpc';
import { PanelInfo, ProgramPanelInfo, ProjectState } from '../../shared/state';
import { RPCHandler } from '../rpc';
import { SETTINGS } from '../settings';
import { getProjectResultsFile } from '../store';
import { EvalHandlerExtra, EvalHandlerResponse, guardPanel } from './types';

const runningProcesses: Record<string, Set<number>> = {};

function killAllByPanelId(panelId: string) {
  const pids = runningProcesses[panelId];
  if (pids) {
    Array.from(pids).map((pid) => process.kill(pid));
  }
}

export async function evalProgram(
  project: ProjectState,
  panel: PanelInfo,
  { indexIdMap }: EvalHandlerExtra
): Promise<EvalHandlerResponse> {
  const ppi = guardPanel<ProgramPanelInfo>(panel, 'program');
  const programTmp = await makeTmpFile();
  const language = LANGUAGES[ppi.program.type];

  const projectResultsFile = getProjectResultsFile(project.id);

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
    const preamble = language.preamble(projectResultsFile, ppi.id, indexIdMap);
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

      let f: Buffer;
      try {
        f = await fs.readFile(projectResultsFile + ppi.id);
      } catch (e) {
        throw new NoResultError();
      }
      const value = JSON.parse(f.toString());

      return {
        skipWrite: true,
        value,
        stdout: out,
      };
    } catch (e) {
      const resultsFileRE = new RegExp(
        path.basename(projectResultsFile) +
          '(?<id>[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})'
      );
      const match = resultsFileRE.exec(e.message);
      if (match && match.groups && match.groups.id !== ppi.id) {
        const panelSource = indexIdMap.indexOf(match.groups.id);
        throw new InvalidDependentPanelError(panelSource);
      }
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
}

export const killProcessHandler: RPCHandler<void> = {
  resource: 'killProcess',
  handler: function (_: string, body: PanelBody) {
    killAllByPanelId(body.panelId);
  },
};
