import { execFile } from 'child_process';
import fs from 'fs';
import jsesc from 'jsesc';
import { EOL } from 'os';
import { preview } from 'preview';
import { shape } from 'shape';
import { file as makeTmpFile } from 'tmp-promise';
import { Cancelled } from '../../shared/errors';
import log from '../../shared/log';
import { PanelBody } from '../../shared/rpc';
import {
  PanelInfo,
  PanelInfoType,
  PanelResult,
  ProjectState,
} from '../../shared/state';
import { DSPROJ_FLAG, PANEL_FLAG, PANEL_META_FLAG } from '../constants';
import { Dispatch, RPCHandler } from '../rpc';
import { flushUnwritten, getProjectResultsFile } from '../store';
import { evalColumns, evalLiteral } from './columns';
import { evalDatabase } from './database';
import { evalFilterAggregate } from './filagg';
import { evalFile } from './file';
import { evalHTTP } from './http';
import { evalProgram } from './program';
import { getProjectAndPanel } from './shared';
import { EvalHandlerExtra, EvalHandlerResponse } from './types';

type EvalHandler = (
  project: ProjectState,
  panel: PanelInfo,
  extra: EvalHandlerExtra,
  dispatch: Dispatch
) => Promise<EvalHandlerResponse>;

const EVAL_HANDLERS: { [k in PanelInfoType]: EvalHandler } = {
  filagg: evalFilterAggregate,
  file: evalFile,
  http: evalHTTP,
  program: evalProgram,
  database: evalDatabase,
  table: evalColumns,
  graph: evalColumns,
  literal: evalLiteral,
};

const runningProcesses: Record<string, Set<number>> = {};

function killAllByPanelId(panelId: string) {
  const workers = runningProcesses[panelId];
  if (workers) {
    Array.from(workers).map((pid) => {
      try {
        process.kill(pid, 'SIGINT');
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
  subprocess: string,
  projectName: string,
  panelId: string
) {
  const tmp = await makeTmpFile({ prefix: 'resultmeta-' });
  let pid = 0;

  try {
    // This means only one user can run a panel at a time
    killAllByPanelId(panelId);

    const child = execFile(
      process.argv[0],
      [
        subprocess,
        DSPROJ_FLAG,
        projectName,
        PANEL_FLAG,
        panelId,
        PANEL_META_FLAG,
        tmp.path,
      ],
      {
        windowsHide: true,
      }
    );

    pid = child.pid;
    if (!runningProcesses[panelId]) {
      runningProcesses[panelId] = new Set();
    }
    runningProcesses[panelId].add(pid);

    let stderr = '';
    child.stderr.on('data', (data) => {
      // Can't find any way to suppress this error appearing in Node processes.
      if (data.includes('stream/web is an experimental feature.')) {
        return;
      }
      stderr += data;
    });

    child.stdout.on('data', (data) => {
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
          }

          if (code === 1 || code === null) {
            reject(new Cancelled());
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

    const resultMeta = fs.readFileSync(tmp.path);
    return JSON.parse(resultMeta.toString());
  } finally {
    try {
      if (pid) {
        runningProcesses[panelId].delete(pid);
      }

      tmp.cleanup();
    } catch (e) {
      log.error(e);
    }
  }
}

export const makeEvalHandler = (
  subprocessEval?: string
): RPCHandler<PanelBody, PanelResult> => ({
  resource: 'eval',
  handler: async function (
    projectId: string,
    body: PanelBody,
    dispatch: Dispatch
  ): Promise<PanelResult> {
    // Flushes desktop panel writes to disk. Not relevant in server context.
    flushUnwritten();

    const { project, panel, panelPage } = await getProjectAndPanel(
      dispatch,
      projectId,
      body.panelId
    );

    if (subprocessEval) {
      return evalInSubprocess(
        subprocessEval,
        project.projectName,
        body.panelId
      );
    }

    const indexIdMap = project.pages[panelPage].panels.map((p) => p.id);
    const indexShapeMap = project.pages[panelPage].panels.map(
      (p) => p.resultMeta.shape
    );

    const evalHandler = EVAL_HANDLERS[panel.type];
    const res = await evalHandler(
      project,
      panel,
      {
        indexIdMap,
        indexShapeMap,
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

    return {
      stdout: res.stdout || '',
      preview: preview(res.value),
      shape: s,
      value: res.returnValue ? res.value : null,
      size: json.length,
      arrayCount: s.kind === 'array' ? (res.value || []).length : null,
      contentType: res.contentType || 'application/json',
    };
  },
});

export const killProcessHandler: RPCHandler<PanelBody, void> = {
  resource: 'killProcess',
  handler: async function (_: string, body: PanelBody) {
    killAllByPanelId(body.panelId);
  },
};
