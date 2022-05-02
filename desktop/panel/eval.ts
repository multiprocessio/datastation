import { execFile } from 'child_process';
import fs from 'fs';
import circularSafeStringify from 'json-stringify-safe';
import { EOL } from 'os';
import path from 'path';
import { file as makeTmpFile } from 'tmp-promise';
import { Cancelled, EVAL_ERRORS, NoResultError } from '../../shared/errors';
import log from '../../shared/log';
import { newId } from '../../shared/object';
import { PanelBody } from '../../shared/rpc';
import { ConnectorInfo, PanelInfo, PanelResult } from '../../shared/state';
import {
  CODE_ROOT,
  DISK_ROOT,
  DSPROJ_FLAG,
  FS_BASE_FLAG,
  PANEL_FLAG,
  PANEL_META_FLAG,
  SETTINGS_FILE_FLAG,
} from '../constants';
import { ensureFile } from '../fs';
import { parsePartialJSONFile } from '../partial';
import { Dispatch, RPCHandler } from '../rpc';
import { getProjectResultsFile } from '../store';
import { getProjectAndPanel } from './shared';

const runningProcesses: Record<string, Set<number>> = {};
const cancelledPids = new Set<number>();

function killAllByPanelId(panelId: string) {
  const workers = runningProcesses[panelId];
  if (workers) {
    Array.from(workers).map((pid) => {
      try {
        log.info('Killing existing process');
        process.kill(pid, 'SIGINT');
        cancelledPids.add(pid);
      } catch (e) {
        // If process doesn't exist, that's ok
        if (!e.message.includes('ESRCH')) {
          throw e;
        }
      }
    });
  }
}

export async function evalInSubprocess(
  subprocess: {
    node: string;
    go?: string;
    settingsFileOverride?: string;
  },
  projectName: string,
  panel: PanelInfo,
  connectors: ConnectorInfo[]
): Promise<[Partial<PanelResult>, string]> {
  const tmp = await makeTmpFile({ prefix: 'resultmeta-' });
  let pid = 0;

  try {
    // This means only one user can run a panel at a time
    killAllByPanelId(panel.id);

    let base = process.argv[0];
    const args = [
      subprocess.node,
      DSPROJ_FLAG,
      projectName,
      PANEL_FLAG,
      panel.id,
      PANEL_META_FLAG,
      tmp.path,
      FS_BASE_FLAG,
      DISK_ROOT.value,
    ];

    if (subprocess.settingsFileOverride) {
      args.push(SETTINGS_FILE_FLAG, subprocess.settingsFileOverride);
    }

    if (subprocess.go) {
      base = subprocess.go;
      args.shift();
    }

    // Only run during tests, triggering Go code coverage
    // https://blog.cloudflare.com/go-coverage-with-external-tests/
    if (subprocess.go && subprocess.go.includes('_test')) {
      ensureFile(path.join(CODE_ROOT, 'coverage', 'fake.cov'));
      args.unshift('-test.run');
      args.unshift('^TestRunMain$');
      args.unshift('-test.coverprofile=coverage/gorunner.' + newId() + '.cov');
    }

    log.info(`Launching "${base} ${args.join(' ')}"`);
    const child = execFile(base, args, {
      windowsHide: true,
    });

    pid = child.pid;
    if (!runningProcesses[panel.id]) {
      runningProcesses[panel.id] = new Set();
    }
    runningProcesses[panel.id].add(pid);

    let stderr = '';
    child.stderr.on('data', (data) => {
      // Can't find any way to suppress this error appearing in Node processes.
      if (data.includes('stream/web is an experimental feature.')) {
        return;
      }
      stderr += data;
      process.stderr.write(data);
    });

    child.stdout.on('data', (data) => {
      stderr += data;
      process.stdout.write(data);
    });

    await new Promise<void>((resolve, reject) => {
      try {
        child.on('exit', (code) => {
          if (code === 0) {
            if (stderr) {
              process.stderr.write(stderr + EOL);
            }
            resolve();
            return;
          }

          if (cancelledPids.has(pid)) {
            cancelledPids.delete(pid);
            reject(new Cancelled());
            return;
          }

          reject(new Error(stderr));
        });
      } catch (e) {
        if (stderr) {
          process.stderr.write(stderr + EOL);
        }
        reject(e);
      }
    });

    const resultMeta = JSON.parse(fs.readFileSync(tmp.path).toString());
    let parsePartial = typeof resultMeta.preview === 'undefined';
    if (!parsePartial) {
      const rm: Partial<PanelResult> = resultMeta;
      // Case of existing Node.js runner
      return [rm, stderr];
    }

    // Case of new Go runner
    const projectResultsFile = getProjectResultsFile(projectName);
    let rm: Partial<PanelResult>;
    try {
      rm = parsePartialJSONFile(projectResultsFile + panel.id);
    } catch (e) {
      if (!e.stdout) {
        e.stdout = resultMeta.stdout;
      }

      if (e instanceof NoResultError && resultMeta.exception) {
        // do nothing. The underlying exception is more interesting
      } else {
        throw e;
      }
    }
    return [{ ...rm, ...resultMeta }, stderr];
  } finally {
    try {
      if (pid) {
        runningProcesses[panel.id].delete(pid);
      }

      tmp.cleanup();
    } catch (e) {
      log.error(e);
    }
  }
}

async function evalNoUpdate(
  projectId: string,
  body: PanelBody,
  dispatch: Dispatch,
  subprocessEval?: {
    node: string;
    go?: string;
  }
): Promise<[Partial<PanelResult>, string]> {
  const { project, panel } = await getProjectAndPanel(
    dispatch,
    projectId,
    body.panelId
  );

  // Reset the result
  await dispatch({
    resource: 'updatePanelResult',
    projectId,
    body: { data: new PanelResult(), panelId: panel.id },
  });

  if (!subprocessEval) {
    throw new Error('Developer error: all eval must use subprocess');
  }

  return evalInSubprocess(
    subprocessEval,
    project.projectName,
    panel,
    project.connectors
  );
}

export const makeEvalHandler = (subprocessEval?: {
  node: string;
  go?: string;
}): RPCHandler<PanelBody, PanelResult> => ({
  resource: 'eval',
  handler: async function (
    projectId: string,
    body: PanelBody,
    dispatch: Dispatch
  ): Promise<PanelResult> {
    // Clear out existing results. This isn't ideal but harder to do correctness without
    const projectResultsFile = getProjectResultsFile(projectId);
    try {
      fs.unlinkSync(projectResultsFile + body.panelId);
    } catch (e) {
      /* ignore */
    }

    let stderr = '';
    const start = new Date();
    let res: Partial<PanelResult> = { loading: true };
    try {
      [res, stderr] = await evalNoUpdate(
        projectId,
        body,
        dispatch,
        subprocessEval
      );
    } catch (e) {
      log.error(e);
      res.exception = e;
      if (res.exception.stdout) {
        res.stdout = res.exception.stdout;
        delete res.exception.stdout;
      }
    }

    if (
      res.exception &&
      !EVAL_ERRORS.find((ee) => ee.name === res.exception.name) &&
      stderr
    ) {
      // Just a generic exception, we already caught all info in `stderr`, so just store that.
      res.exception = new Error(res.stdout || stderr);
    }

    // I'm not really sure why this is necessary but sometimes the
    // exception comes out in an object that can't be stringified. And
    // yet I don't believe there's any throwing of errors from the Go
    // code.
    if (res.exception && circularSafeStringify(res.exception) === '{}') {
      res.exception = {
        name: res.exception.name,
        message: res.exception.message,
        ...res.exception,
      };
    }

    res.lastRun = start;
    res.loading = false;
    res.elapsed = new Date().valueOf() - start.valueOf();
    await dispatch({
      resource: 'updatePanelResult',
      projectId,
      body: { data: res, panelId: body.panelId },
    });
    return Object.assign(new PanelResult(), res);
  },
});

export const killProcessHandler: RPCHandler<PanelBody, void> = {
  resource: 'killProcess',
  handler: async function (_: string, body: PanelBody) {
    killAllByPanelId(body.panelId);
  },
};
