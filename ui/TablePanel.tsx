import * as React from 'react';
import { PanelResult, TablePanelInfo, TableColumn } from './ProjectStore';

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
        <span>Panel Source:</span>
        <input
          type="number"
          min={0}
          max={panelCount - 1}
          value={panel.table.panelSource}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            panel.table.panelSource = +e.target.value;
            updatePanel(panel);
          }}
        />
      </div>
      <div>
        <span>Columns</span>
        {panel.table.columns.map((c) => (
          <div>
            Field:
            <input
              value={c.field}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                c.field = e.target.value;
                updatePanel(panel);
              }}
            />
            Label:
            <input
              value={c.label}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                c.label = e.target.value;
                updatePanel(panel);
              }}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            panel.table.columns.push({ label: '', field: '' });
            updatePanel(panel);
          }}
        >
          Add Column
        </button>
      </div>
    </React.Fragment>
  );
}

export function TablePanel({
  panel,
  panelIndex,
  rows,
}: {
  panel: TablePanelInfo;
  panelIndex: number;
  rows: Array<PanelResult>;
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
        {((rows[panelIndex] || {}).value || []).map((row: any, i: number) => (
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
