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

export function parsePartialJSONFile(file: string, maxBytesToRead: number) {
  let fd: number;
  try {
    fd = fs.openSync(file, 'r');
  } catch (e) {
    throw new NoResultError();
  }

  const { size } = fs.statSync(file);

  if (size < maxBytesToRead) {
    const f = fs.readFileSync(file).toString();
    const value = JSON.parse(f);
    return {
      size,
      value,
      arrayCount: f.charAt(0) === '[' ? value.length : null,
    };
  }

  try {
    let done = false;
    let f = '';
    const incomplete = [];
    let inString = false;

    while (!done) {
      const bufferSize = 1024;
      const b = Buffer.alloc(bufferSize);
      const bytesRead = fs.readSync(fd, b);

      // To be able to iterate over code points
      let bs = Array.from(b.toString());
      outer: for (let i = 0; i < bs.length; i++) {
        const c = bs[i];
        if (c !== '"' && inString) {
          continue;
        }

        switch (c) {
          case '"':
            const previous =
              i + bs.length === 0
                ? ''
                : i > 0
                ? bs[i - 1]
                : f.charAt(f.length - 1);
            const isEscaped = previous === '\\';
            if (!isEscaped) {
              inString = !inString;
            }
            break;
          case '{':
          case '[':
            incomplete.push(c);
            break;
          case ']':
          case '}':
            if (f.length + bufferSize >= maxBytesToRead) {
              bs = bs.slice(0, i);
              // Need to not count additional openings after this
              done = true;
              break outer;
            }

            // Otherwise, pop it
            incomplete.pop();
            break;
        }
      }

      f += bs.join('');
      if (bytesRead < bufferSize) {
        break;
      }
    }

    while (incomplete.length) {
      if (incomplete.pop() === '{') {
        f += '}';
      } else {
        f += ']';
      }
    }

    const value = JSON.parse(f);

    return {
      size,
      value,
      arrayCount: f.charAt(0) === '[' ? 'More than ' + value.length : null,
    };
  } finally {
    fs.closeSync(fd);
  }
}

export async function evalProgram(
  project: ProjectState,
  panel: PanelInfo,
  { idMap }: EvalHandlerExtra
): Promise<EvalHandlerResponse> {
  const ppi = guardPanel<ProgramPanelInfo>(panel, 'program');
  const programTmp = await makeTmpFile({ prefix: 'program-tmp-' });
  const language = LANGUAGES[ppi.program.type];

  const projectResultsFile = getProjectResultsFile(project.projectName);

  if (language.nodeEval) {
    const res = language.nodeEval(ppi.content, {
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
      idMap
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

      const { size, value, arrayCount } = parsePartialJSONFile(
        projectResultsFile + ppi.id,
        100_000
      );

      return {
        skipWrite: true,
        value,
        stdout: out,
        size,
        arrayCount,
      };
    } catch (e) {
      const resultsFileRE = new RegExp(
        path.basename(projectResultsFile) +
          '(?<id>[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})'
      );
      const match = resultsFileRE.exec(e.message);
      if (match && match.groups && match.groups.id !== ppi.id) {
        throw new InvalidDependentPanelError(match.groups.id);
      }
      e.message = language.exceptionRewriter(e.message, programTmp.path);
      e.stdout = out;
      throw e;
    }
  } finally {
    programTmp.cleanup();
  }
}
