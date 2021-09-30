import { DSPROJ_FLAG, PANEL_FLAG, PANEL_META_FLAG } from './constants';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import { file as makeTmpFile } from 'tmp-promise';
import jsesc from 'jsesc';
import { preview } from 'preview';
import { shape } from 'shape';
import { PanelBody } from '../../shared/rpc';
import log from '../../shared/log';
import {
  PanelInfo,
  PanelInfoType,
  PanelResult,
  ProjectState,
} from '../../shared/state';
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

export async function evalInSubprocess(subprocess: string, projectId: string, panelId: string) {
  const tmp = await makeTmpFile();

  try {
    const child = spawn(subprocessEval, [DSPROJ_FLAG, projectId, PANEL_FLAG, panelId, PANEL_META_FLAG, tmp.path]);

    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data;
    });

    try {
      return new Promise((resolve, reject) => {
	try {
	  child.on('close', resolve);
	} catch (e) {
	  reject(e);
	}
      });
    } catch (e) {
      log.error(e);
      throw new Error(stderr);
    }
  } finally {
    try {
      await tmp.close();
    } catch (e) {
      log.error(e);
    }
  }
}

export const makeEvalHandler: (subprocessEval?: string): RPCHandler<PanelBody, PanelResult> {
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
      return evalInSubprocess(subprocessEval, project.id, body.panelId);
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
};
