import * as React from 'react';

import {
  PanelInfo,
  TablePanelInfo,
  TableColumn,
  PanelResult,
} from '../shared/state';

import { PanelSourcePicker } from './PanelSourcePicker';
import { Button } from './component-library/Button';
import { FieldPicker } from './FieldPicker';

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
        {panel.table.columns.map((c) => (
          <div className="form-row">
            <FieldPicker
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
        {((panelResults[panel.table.panelSource] || {}).value || []).map(
          (row: any, i: number) => (
            <tr key={i}>
              {panel.table.columns.map((column: TableColumn) => (
                <td key={column.field}>{row[column.field]}</td>
              ))}
            </tr>
          )
        )}
      </tbody>
    </table>
  );
}
