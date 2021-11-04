import { Dispatch } from '@datastation/desktop/rpc';
import {
  GraphPanelInfo,
  LiteralPanelInfo,
  PanelInfo,
  ProjectState,
  TablePanelInfo,
} from '@datastation/shared/state';
import { columnsFromObject } from '@datastation/shared/table';
import { parseArrayBuffer } from '@datastation/shared/text';
import { getPanelResult } from './shared';
import { EvalHandlerExtra, EvalHandlerResponse, guardPanel } from './types';

export async function evalColumns(
  project: ProjectState,
  panel: PanelInfo,
  { indexIdMap }: EvalHandlerExtra,
  dispatch: Dispatch
): Promise<EvalHandlerResponse> {
  let columns: Array<string>;
  let panelSource: string;
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
    panelSource
  );

  const valueWithRequestedColumns = columnsFromObject(
    value,
    columns,
    indexIdMap.indexOf(panelSource)
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
