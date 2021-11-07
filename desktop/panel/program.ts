import { spawn } from 'child_process';
import fs from 'fs';
import { EOL } from 'os';
import path from 'path';
import { file as makeTmpFile } from 'tmp-promise';
import { InvalidDependentPanelError, NoResultError } from '../../shared/errors';
import { LANGUAGES } from '../../shared/languages';
import { PanelInfo, ProgramPanelInfo, ProjectState } from '../../shared/state';
import { SETTINGS } from '../settings';
import { getProjectResultsFile } from '../store';
import { EvalHandlerExtra, EvalHandlerResponse, guardPanel } from './types';

export async function evalProgram(
  project: ProjectState,
  panel: PanelInfo,
  { idMap }: EvalHandlerExtra
): Promise<EvalHandlerResponse> {
  const ppi = guardPanel<ProgramPanelInfo>(panel, 'program');
  const programTmp = await makeTmpFile({ prefix: 'program-tmp-' });
  const language = LANGUAGES[ppi.program.type];

  const projectResultsFile = getProjectResultsFile(project.projectName);

  if (!language.defaultPath) {
    const res = await language.inMemoryEval(ppi.content, {
      resultsFile: projectResultsFile,
      idMap,
    });

    return { value: res.value, stdout: res.stdout };
  }

  const programPathOrName =
    SETTINGS.languages[ppi.program.type].path || language.defaultPath;

  let out = '';
  try {
    const preamble = language.preamble(
      projectResultsFile.replaceAll('\\', '/'),
      ppi.id,
      indexIdMap
    );
    const fullProgramBody = [preamble, ppi.content].join(EOL);
    fs.writeFileSync(programTmp.path, fullProgramBody);
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

      const code = await new Promise((resolve) => child.on('close', resolve));
      if (code !== 0) {
        throw new Error(stderr);
      }

      let f: Buffer;
      try {
        f = fs.readFileSync(projectResultsFile + ppi.id);
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
    programTmp.cleanup();
  }
}
