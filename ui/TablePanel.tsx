import * as React from 'react';

import { TablePanelInfo, TableColumn } from './../shared/state';

import { PanelResult } from './ProjectStore';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';

export function TablePanelDetails({
  panel,
  updatePanel,
  panelCount,
}: {
  panel: TablePanelInfo;
  updatePanel: (d: TablePanelInfo) => void;
  panelCount: number;
}) {
  return (
    <React.Fragment>
      <div>
        <Input
          label="Panel Source"
          type="number"
          min={0}
          max={panelCount - 1}
          value={panel.table.panelSource.toString()}
          onChange={(value: string) => {
            panel.table.panelSource = +value;
            updatePanel(panel);
          }}
        />
      </div>
      <div>
        <label>Columns</label>
        {panel.table.columns.map((c) => (
          <div>
            <Input
              label="Field"
              value={c.field}
              onChange={(value: string) => {
                c.field = value;
                updatePanel(panel);
              }}
            />
            <Input
              label="Label"
              value={c.label}
              onChange={(value: string) => {
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
