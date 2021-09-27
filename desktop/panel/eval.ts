import fs from 'fs/promises';
import jsesc from 'jsesc';
import { preview } from 'preview';
import { shape } from 'shape';
import { EvalBody } from '../../shared/rpc';
import {
  PanelInfo,
  PanelInfoType,
  PanelResult,
  ProjectState,
} from '../../shared/state';
import { Dispatch } from '../rpc';
import { getProjectResultsFile } from '../store';
import { evalColumns, evalLiteral } from './columns';
import { evalFilterAggregate } from './filagg';
import { evalFile } from './file';
import { evalHTTP } from './http';
import { evalProgram } from './program';
import { EvalHandlerExtra, EvalHandlerResponse } from './types';

type EvalHandler = (
  project: ProjectState,
  panel: PanelInfo,
  extra: EvalHandlerExtra
) => Promise<EvalHandlerResponse>;

const EVAL_HANDLERS: { [k in PanelInfoType]: EvalHandler } = {
  filagg: evalFilterAggregate,
  file: evalFile,
  http: evalHTTP,
  program: evalProgram,
  database: evaldatabase,
  table: evalColumns,
  graph: evalColumns,
  literal: evalLiteral,
};

export const evalHandler = {
  resource: 'eval',
  handler: async function (
    projectId: string,
    body: EvalBody,
    dispatch: Dispatch
  ): Promise<PanelResult> {
    const project =
      ((await dispatch({
        resource: 'getProject',
        projectId,
        body: { projectId, internal: true },
      })) as ProjectState) || new ProjectState();
    let panelPage = 0;
    let panel: PanelInfo;
    for (; !panel && panelPage < (project.pages || []).length; panelPage++) {
      for (const p of project.pages[panelPage].panels || []) {
        if (p.id === body.panel.id) {
          panel = p;
          break;
        }
      }
    }
    if (!panel) {
      throw new Error('Unable to find panel.');
    }

    const indexIdMap = project.pages[panelPage].panels.map((p) => p.id);
    const indexShapeMap = project.pages[panelPage].panels.map(
      (p) => p.resultMeta.shape
    );

    const evalHandler = EVAL_HANDLERS[panel.type];
    const res = await evalHandler(project, panel, {
      indexIdMap,
      indexShapeMap,
    });

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
