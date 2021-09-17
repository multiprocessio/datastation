import { preview } from 'preview';
import * as React from 'react';
import { shape } from 'shape';
import { MODE } from '../shared/constants';
import { InvalidDependentPanelError } from '../shared/errors';
import {
  PanelInfo,
  PanelResult,
  TableColumn,
  TablePanelInfo,
} from '../shared/state';
import { columnsFromObject } from '../shared/table';
import { asyncRPC } from './asyncRPC';
import { Alert } from './component-library/Alert';
import { Button } from './component-library/Button';
import { FormGroup } from './component-library/FormGroup';
import { FieldPicker } from './FieldPicker';
import { PanelSourcePicker } from './PanelSourcePicker';

export async function evalColumnPanel(
  panelSource: number,
  columns: Array<string>,
  indexIdMap: Array<string>,
  panelResults: Array<PanelResult>
) {
  if (MODE === 'browser') {
    if (!panelResults || !panelResults[panelSource]) {
      throw new InvalidDependentPanelError(panelSource);
    }
    const { value } = panelResults[panelSource];
    try {
      const valueWithRequestedColumns = columnsFromObject(
        value,
        columns,
        panelSource
      );
      return {
        value: valueWithRequestedColumns,
        preview: preview(valueWithRequestedColumns),
        shape: shape(valueWithRequestedColumns),
        stdout: '',
        size: value ? JSON.stringify(value).length : 0,
        contentType: 'application/json',
      };
    } catch (e) {
      throw e;
    }
  }

  return await asyncRPC<
    {
      columns: Array<string>;
      panelSource: number;
      indexIdMap: Array<string>;
    },
    void,
    PanelResult
  >('evalColumns', null, {
    panelSource,
    indexIdMap,
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
      <FormGroup label="General">
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
      </FormGroup>
      <FormGroup label="Columns">
        {panel.table.columns.map((c, i) => (
          <div className="form-row vertical-align-center" key={c.field + i}>
            <FieldPicker
              used={panel.table.columns.map((c) => c.field)}
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
      </FormGroup>
    </React.Fragment>
  );
}

export function TablePanel({
  panel,
  data,
}: {
  panel: TablePanelInfo;
  data?: { value?: Array<any> };
}) {
  let valueAsArray: Array<any> = [];
  if (data && data.value && Array.isArray(data.value)) {
    valueAsArray = data.value;
  }

  if (!panel.table.columns || !panel.table.columns.length) {
    return (
      <Alert type="info">
        There are no columns to display. Add columns in the panel details.
      </Alert>
    );
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
