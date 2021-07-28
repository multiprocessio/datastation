import { preview } from 'preview';
import * as React from 'react';
import { shape } from 'shape';
import { MODE } from '../shared/constants';
import { columnsFromObject } from '../shared/object';
import {
  PanelInfo,
  PanelResult,
  TableColumn,
  TablePanelInfo,
} from '../shared/state';
import { asyncRPC } from './asyncRPC';
import { Button } from './component-library/Button';
import { FieldPicker } from './FieldPicker';
import { PanelSourcePicker } from './PanelSourcePicker';

export async function evalColumnPanel(
  panelSource: number,
  columns: Array<string>,
  indexIdMap: Array<string>,
  panelResults: Array<PanelResult>
) {
  if (MODE === 'browser') {
    const { value } = panelResults[panelSource];
    const valueWithRequestedColumns = columnsFromObject(value, columns);
    return {
      value: valueWithRequestedColumns,
      preview: preview(valueWithRequestedColumns),
      shape: shape(valueWithRequestedColumns),
      stdout: '',
      size: JSON.stringify(value).length,
      contentType: 'application/json',
    };
  }

  return await asyncRPC<
    {
      columns: Array<string>;
      id: string;
    },
    void,
    PanelResult
  >('evalColumns', null, {
    id: indexIdMap[panelSource],
    columns,
  });
}

export function TablePanelDetails({
  panel,
  panels,
  updatePanel,
  data,
}: {
  panel: TablePanelInfo;
  updatePanel: (d: TablePanelInfo) => void;
  panels: Array<PanelInfo>;
  data: PanelResult;
}) {
  return (
    <React.Fragment>
      <div className="form-row">
        <PanelSourcePicker
          currentPanel={panel.id}
          panels={panels}
          value={panel.table.panelSource}
          onChange={(value: number) => {
            panel.table.panelSource = value;
            updatePanel(panel);
          }}
        />
      </div>
      <div className="form-row">
        <label>Columns</label>
        {panel.table.columns.map((c, i) => (
          <div className="form-row">
            <FieldPicker
              onDelete={() => {
                panel.table.columns.splice(i, 1);
                updatePanel(panel);
              }}
              label="Field"
              value={c.field}
              panelSourceResult={data}
              onChange={(value: string) => {
                c.field = value;
                updatePanel(panel);
              }}
              labelValue={c.label}
              labelOnChange={(value: string) => {
                c.label = value;
                updatePanel(panel);
              }}
            />
          </div>
        ))}
        <Button
          onClick={() => {
            panel.table.columns.push({ label: '', field: '' });
            updatePanel(panel);
          }}
        >
          Add Column
        </Button>
      </div>
    </React.Fragment>
  );
}

export function TablePanel({
  panel,
  panelResults,
}: {
  panel: TablePanelInfo;
  panelResults: Array<PanelResult>;
}) {
  let valueAsArray = (panelResults[panel.table.panelSource] || {}).value || [];
  // Panels don't have to be an array. Don't crash if the currently selected one is not one.
  if (!Array.isArray(valueAsArray)) {
    valueAsArray = [];
  }
  return (
    <table>
      <thead>
        <tr>
          {panel.table.columns.map((column: TableColumn) => (
            <th key={column.field}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {valueAsArray.map((row: any, i: number) => (
          <tr key={i}>
            {panel.table.columns.map((column: TableColumn) => (
              <td key={column.field}>{row[column.field]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
