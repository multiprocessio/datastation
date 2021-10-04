import fs from 'fs';
import { PanelBody } from '../../shared/rpc';
import {
  GraphPanelInfo,
  LiteralPanelInfo,
  PanelInfo,
  ProjectState,
  TablePanelInfo,
} from '../../shared/state';
import { columnsFromObject } from '../../shared/table';
import { parseArrayBuffer } from '../../shared/text';
import { Dispatch, RPCHandler } from '../rpc';
import { getProjectResultsFile } from '../store';
import { getPanelResult, getProjectAndPanel } from './shared';
import { EvalHandlerExtra, EvalHandlerResponse, guardPanel } from './types';

export async function evalColumns(
  project: ProjectState,
  panel: PanelInfo,
  { indexIdMap }: EvalHandlerExtra,
  dispatch: Dispatch
): Promise<EvalHandlerResponse> {
  let columns: Array<string>;
  let panelSource: number;
  if (panel.type === 'graph') {
    const gp = panel as GraphPanelInfo;
    columns = [gp.graph.x, ...gp.graph.ys.map((y) => y.field)];
    panelSource = gp.graph.panelSource;
  } else if (panel.type === 'table') {
    const tp = panel as TablePanelInfo;
    columns = tp.table.columns.map((c) => c.field);
    panelSource = tp.table.panelSource;
  } else {
    // Let guardPanel throw a nice error.
    guardPanel<GraphPanelInfo>(panel, 'graph');
  }

  const { value } = await getPanelResult(
    dispatch,
    project.projectName,
    indexIdMap[panelSource]
  );

  const valueWithRequestedColumns = columnsFromObject(
    value,
    columns,
    panelSource
  );

  return {
    value: valueWithRequestedColumns,
    returnValue: true,
  };
}

export async function evalLiteral(
  project: ProjectState,
  panel: PanelInfo
): Promise<EvalHandlerResponse> {
  const {
    literal: { contentTypeInfo },
  } = guardPanel<LiteralPanelInfo>(panel, 'literal');
  return await parseArrayBuffer(contentTypeInfo, '', panel.content);
}

export const fetchResultsHandler: RPCHandler<PanelBody, EvalHandlerResponse> = {
  resource: 'fetchResults',
  handler: async function (
    projectId: string,
    body: PanelBody,
    dispatch: Dispatch
  ): Promise<EvalHandlerResponse> {
    const { panel } = await getProjectAndPanel(
      dispatch,
      projectId,
      body.panelId
    );

    // Maybe the only appropriate place to call this in this package?
    const projectResultsFile = getProjectResultsFile(projectId);
    const f = fs.readFileSync(projectResultsFile + panel.id);

    // Everything gets stored as JSON on disk. Even literals and files get rewritten as JSON.
    return { value: JSON.parse(f.toString()) };
  },
};
