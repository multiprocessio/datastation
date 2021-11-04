import { preview } from '@multiprocess/preview';
import { shape } from '@multiprocess/shape';
import fs from 'fs';
import jsesc from 'jsesc';
import { Dispatch, RPCHandler } from '../desktop/rpc';
import { getProjectResultsFile } from '../desktop/store';
import { PanelBody } from '../shared/rpc';
import {
  PanelInfo,
  PanelInfoType,
  PanelResult,
  ProjectState,
} from '../shared/state';
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

export const evalHandler: RPCHandler<PanelBody, PanelResult> = {
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
};
