import fs from 'fs/promises';
import jsesc from 'jsesc';
import { preview } from 'preview';
import { shape } from 'shape';
import { file as makeTmpFile } from 'tmp-promise';
import { Worker } from 'worker_threads';
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

const runningProcesses: Record<string, Record<string, Worker>> = {};

async function killAllByPanelId(panelId: string) {
  const workers = runningProcesses[panelId];
  if (workers) {
    await Promise.all(
      Object.values(workers).map((worker) => worker.terminate())
    );
  }
}

export async function evalInSubprocess(
  subprocess: string,
  projectName: string,
  panelId: string
) {
  const tmp = await makeTmpFile();
  let threadId = 0;

  try {
    // This means only one user can run a panel at a time
    killAllByPanelId(panelId);
    if (!runningProcesses[panelId]) {
      runningProcesses[panelId] = {};
    }

    const child = new Worker(subprocess, {
      argv: [
        DSPROJ_FLAG,
        projectName,
        PANEL_FLAG,
        panelId,
        PANEL_META_FLAG,
        tmp.path,
      ],
    });

    threadId = child.threadId;
    runningProcesses[panelId][threadId] = child;

    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data;
    });

    await new Promise<void>((resolve, reject) => {
      try {
        child.on('error', reject);
        child.on('exit', (code) => {
          if (code === 0) {
            resolve();
          }

          if (code === 1) {
            reject(new Cancelled());
          }

          reject('Exited with ' + code + '\n' + stderr);
        });
      } catch (e) {
        reject(e + '\n' + stderr);
      }
    });

    const resultMeta = await fs.readFile(tmp.path);
    return JSON.parse(resultMeta.toString());
  } finally {
    try {
      if (threadId) {
        delete runningProcesses[panelId][threadId];
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
      await fs.writeFile(projectResultsFile + panel.id, json);
    }

    return {
      stdout: res.stdout || '',
      preview: preview(res.value),
      shape: shape(res.value),
      value: res.returnValue ? res.value : null,
      size: json.length,
      contentType: res.contentType || 'application/json',
    };
  },
});

export const killProcessHandler: RPCHandler<PanelBody, void> = {
  resource: 'killProcess',
  handler: function (_: string, body: PanelBody) {
    return killAllByPanelId(body.panelId);
  },
};
