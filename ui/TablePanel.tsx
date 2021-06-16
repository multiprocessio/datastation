import * as React from 'react';

import { PanelInfo, TablePanelInfo, TableColumn } from './../shared/state';

import { PanelSourcePicker } from './PanelSourcePicker';
import { PanelResult } from './ProjectStore';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';

export function TablePanelDetails({
  panel,
  panels,
  updatePanel,
}: {
  panel: TablePanelInfo;
  updatePanel: (d: TablePanelInfo) => void;
  panels: Array<PanelInfo>;
}) {
  return (
    <React.Fragment>
      <div>
        <PanelSourcePicker
          panels={panels}
          value={panel.table.panelSource}
          onChange={(value: number) => {
            panel.table.panelSource = value;
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
