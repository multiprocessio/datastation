import fs from 'fs/promises';
import { LiteralPanelInfo } from '../../shared/state';
import { columnsFromObject } from '../../shared/table';
import { parseArrayBuffer } from '../../shared/text';
import { getProjectResultsFile } from '../store';
import { additionalParsers } from './http';
import { EvalHandlerExtra, EvalHandlerResponse, guardPanel } from './types';

export async function evalColumns(
  project: ProjectState,
  panel: PanelInfo,
  extra: EvalHandlerExtra,
  dispatch: Dispatch
): Promise<EvalHandlerResponse> {
  let columns: Array<string>;
  let panelSource: number;
  if (panel.type === 'graph') {
    columns = [panel.graph.x.field, ...panel.graph.ys.map((y) => y.field)];
    panelSource = panel.graph.panelSource;
  } else if (panel.type === 'table') {
    columns = panel.table.columns.map((c) => c.field);
    panelSource = panel.table.panelSource;
  } else {
    // Let guardPanel throw a nice error.
    guardPanel<void>(panel, 'graph');
  }

  const projectResultsFile = getProjectResultsFile(project.id);
  const f = await fs.readFile(projectResultsFile + id);
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

export function evalLiteral(
  project: ProjectState,
  panel: PanelInfo,
  extra: EvalHandlerExtra,
  dispatch: Dispatch
): Promise<EvalHandlerResponse> {
  const {
    literal: { contentTypeInfo },
  } = guardPanel<LiteralPanelInfo>(panel, 'literal');
  // This should get written to disk by rpcEvalHandler
  // Who handles setting content-type and whatnot here, actually parsing it?
  const typeInfo = { ...contentTypeInfo, additionalParsers };
  return await parseArrayBuffer(typeInfo, name, body);
  return { value: panel.content };
}

export function fetchResultsHandler(
  project: ProjectState,
  panel: PanelInfo,
  extra: EvalHandlerExtra,
  dispatch: Dispatch
): Promise<EvalHandlerResponse> {
  const projectResultsFile = getProjectResultsFile(project.id);
  const f = await fs.readFile(projectResultsFile + panel.id);
  const value = await parseArrayBuffer(panel.resultMeta.contentType, '', f);
  return { value };
}
