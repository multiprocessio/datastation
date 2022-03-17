import { execFile } from 'child_process';
import fs from 'fs';
import jsesc from 'jsesc';
import { EOL } from 'os';
import path from 'path';
import { preview } from 'preview';
import { shape, Shape } from 'shape';
import { file as makeTmpFile } from 'tmp-promise';
import * as uuid from 'uuid';
import {
  Cancelled,
  EVAL_ERRORS,
  InvalidDependentPanelError,
} from '../../shared/errors';
import log from '../../shared/log';
import { PanelBody } from '../../shared/rpc';
import {
  ConnectorInfo,
  PanelInfo,
  PanelInfoType,
  PanelResult,
  ProjectState,
} from '../../shared/state';
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
import { EvalHandlerExtra, EvalHandlerResponse } from './types';

type EvalHandler = (
  project: ProjectState,
  panel: PanelInfo,
  extra: EvalHandlerExtra,
  dispatch: Dispatch
) => Promise<EvalHandlerResponse>;

function unimplementedInJavaScript(): EvalHandler {
  return function () {
    throw new Error('There is a bug, this condition should not be possible.');
  };
}

const EVAL_HANDLERS: { [k in PanelInfoType]: () => EvalHandler } = {
  table: () => require('./columns').evalColumns,
  graph: () => require('./columns').evalColumns,
  literal: unimplementedInJavaScript,
  database: unimplementedInJavaScript,
  file: unimplementedInJavaScript,
  http: unimplementedInJavaScript,
  program: unimplementedInJavaScript,
  filagg: unimplementedInJavaScript,
};

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

function canUseGoRunner(panel: PanelInfo, connectors: ConnectorInfo[]) {
  return !['table', 'graph'].includes(panel.type);
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
) {
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

    if (subprocess.go && canUseGoRunner(panel, connectors)) {
      base = subprocess.go;
      args.shift();
    }

    // Only run during tests, triggering Go code coverage
    // https://blog.cloudflare.com/go-coverage-with-external-tests/
    if (subprocess.go && subprocess.go.includes('_test')) {
      ensureFile(path.join(CODE_ROOT, 'coverage', 'fake.cov'));
      args.unshift('-test.run');
      args.unshift('^TestRunMain$');
      args.unshift(
        '-test.coverprofile=coverage/gorunner.' + uuid.v4() + '.cov'
      );
    }

    const lastRun = new Date();
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

    const resultMeta = fs.readFileSync(tmp.path).toString();
    let parsePartial = !resultMeta;
    if (!parsePartial) {
      const rm: Partial<PanelResult> = JSON.parse(resultMeta);
      if (rm.exception) {
        const e = EVAL_ERRORS.find((e) => e.name === rm.exception.name);

        // Just a generic exception, we already caught all info in `stderr`, so just throw that.
        if (!e) {
          throw new Error(stderr);
        }

        // These are specific exceptions that will be handled specially in the UI such as InvalidDependentPanelError
        if (e && (e as any).fromJSON) {
          throw (e as any).fromJSON(rm.exception);
        }

        // Unclear what case this is, probably a developer mistake.
        throw new e(rm.exception as any);
      }

      // Case of existing Node.js runner
      rm.lastRun = lastRun;
      rm.loading = false;
      rm.elapsed = new Date().valueOf() - lastRun.valueOf();
      return rm;
    }

    // Case of new Go runner
    const projectResultsFile = getProjectResultsFile(projectName);
    const rm: Partial<PanelResult> = parsePartialJSONFile(
      projectResultsFile + panel.id
    );
    rm.lastRun = lastRun;
    rm.loading = false;
    rm.elapsed = new Date().valueOf() - lastRun.valueOf();
    return rm;
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

function assertValidDependentPanels(
  projectId: string,
  content: string,
  idMap: Record<string | number, string>
) {
  const projectResultsFile = getProjectResultsFile(projectId);
  const re =
    /(DM_getPanel\((?<number>[0-9]+)\))|(DM_getPanel\((?<singlequote>'(?:[^'\\]|\\.)*\')\))|(DM_getPanel\((?<doublequote>"(?:[^"\\]|\\.)*\")\))/g;
  let match = null;
  while ((match = re.exec(content)) !== null) {
    if (match && match.groups) {
      const { number, singlequote, doublequote } = match.groups;
      let m = doublequote || singlequote || number;
      if (["'", '"'].includes(m.charAt(0))) {
        m = m.slice(1, m.length - 1);
      }

      if (!fs.existsSync(projectResultsFile + idMap[m])) {
        throw new InvalidDependentPanelError(m);
      }
    }
  }
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
    const { project, panel, panelPage } = await getProjectAndPanel(
      dispatch,
      projectId,
      body.panelId
    );

    // Reset the result
    await dispatch({
      resource: 'updatePanelResult',
      projectId,
      body: { resultMeta: new PanelResult(), panelId: panel.id },
    });

    if (subprocessEval) {
      const resultMeta = (await evalInSubprocess(
        subprocessEval,
        project.projectName,
        panel,
        project.connectors
      )) as PanelResult;

      await dispatch({
        resource: 'updatePanelResult',
        projectId,
        body: { resultMeta, panelId: panel.id },
      });
      return resultMeta;
    }

    const idMap: Record<string | number, string> = {};
    const idShapeMap: Record<string | number, Shape> = {};
    project.pages[panelPage].panels.forEach((p, i) => {
      idMap[i] = p.id;
      idMap[p.name] = p.id;
      idShapeMap[i] = p.resultMeta.shape;
      idShapeMap[p.name] = p.resultMeta.shape;
    });

    assertValidDependentPanels(projectId, panel.content, idMap);

    const evalHandler = EVAL_HANDLERS[panel.type]();
    const lastRun = new Date();
    const res = await evalHandler(
      project,
      panel,
      {
        idMap,
        idShapeMap,
      },
      dispatch
    );

    // TODO: is it a problem panels like Program skip this escaping?
    // This library is important for escaping responses otherwise some
    // characters can blow up various panel processes.
    const json = jsesc(res.value, { quotes: 'double', json: true });

    if (!res.skipWrite) {
      const projectResultsFile = getProjectResultsFile(projectId);
      fs.writeFileSync(projectResultsFile + panel.id, json);
    }

    const s = shape(res.value);

    const resultMeta = {
      stdout: res.stdout || '',
      preview: preview(res.value),
      shape: s,
      value: res.returnValue ? res.value : null,
      size: res.size === undefined ? json.length : res.size,
      lastRun,
      loading: false,
      elapsed: new Date().valueOf() - lastRun.valueOf(),
      arrayCount:
        res.arrayCount === undefined
          ? s.kind === 'array'
            ? (res.value || []).length
            : null
          : res.arrayCount,
      contentType: res.contentType || 'application/json',
    };
    await dispatch({
      resource: 'updatePanelResult',
      projectId,
      body: { resultMeta, panelId: panel.id },
    });
    return resultMeta;
  },
});

export const killProcessHandler: RPCHandler<PanelBody, void> = {
  resource: 'killProcess',
  handler: async function (_: string, body: PanelBody) {
    killAllByPanelId(body.panelId);
  },
};
