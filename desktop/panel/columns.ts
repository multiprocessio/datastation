import fs from 'fs/promises';
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
import { getProjectAndPanel } from './shared';
import { EvalHandlerResponse, guardPanel } from './types';

export async function evalColumns(
  project: ProjectState,
  panel: PanelInfo
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

  const projectResultsFile = getProjectResultsFile(project.id);
  const f = await fs.readFile(projectResultsFile + panel.id);
  const value = JSON.parse(f.toString());

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

export const fetchResultsHandler: RPCHandler<any> = {
  resource: 'fetchResults',
  handler: async function (
    projectId: string,
    body: PanelBody,
    dispatch: Dispatch
  ): Promise<EvalHandlerResponse> {
    const { panel } = await getProjectAndPanel(
      projectId,
      body.panelId,
      dispatch
    );

    const projectResultsFile = getProjectResultsFile(projectId);
    const f = await fs.readFile(projectResultsFile + panel.id);
    return await parseArrayBuffer(
      {
        type: panel.resultMeta.contentType,
      },
      '',
      f
    );
  },
};
