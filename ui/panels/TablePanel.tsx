import { preview } from 'preview';
import * as React from 'react';
import { shape } from 'shape';
import { MODE } from '../../shared/constants';
import { InvalidDependentPanelError } from '../../shared/errors';
import { PanelResult, TableColumn, TablePanelInfo } from '../../shared/state';
import { columnsFromObject } from '../../shared/table';
import { panelRPC } from '../asyncRPC';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { FieldPicker, unusedFields } from '../components/FieldPicker';
import { FormGroup } from '../components/FormGroup';
import { PanelSourcePicker } from '../components/PanelSourcePicker';
import { PanelBodyProps, PanelDetailsProps, PanelUIDetails } from './types';

export async function evalColumnPanel(
  panelId: string,
  panelSource: number,
  columns: Array<string>,
  _: Array<string>,
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
      const s = shape(valueWithRequestedColumns);
      return {
        value: valueWithRequestedColumns,
        preview: preview(valueWithRequestedColumns),
        shape: s,
        stdout: '',
        size: value ? JSON.stringify(value).length : 0,
        arrayCount: s.kind === 'array' ? (value || []).length : null,
        contentType: 'application/json',
      };
    } catch (e) {
      throw e;
    }
  }

  return await panelRPC('eval', panelId);
}

export function evalTablePanel(
  panel: TablePanelInfo,
  panelResults: Array<PanelResult>,
  indexIdMap: Array<string>
) {
  return evalColumnPanel(
    panel.id,
    panel.table.panelSource,
    panel.table.columns.map((c) => c.field),
    indexIdMap,
    panelResults
  );
}

export function TablePanelDetails({
  panel,
  panels,
  updatePanel,
}: PanelDetailsProps<TablePanelInfo>) {
  const data =
    (panels[panel.table.panelSource] || {}).resultMeta || new PanelResult();
  React.useEffect(() => {
    const fields = unusedFields(
      data?.shape,
      ...panel.table.columns.map((c) => c.field)
    );

    if (fields) {
      panel.table.columns.push({ label: '', field: '' });
      updatePanel(panel);
    }
  }, [panel.table.panelSource, data]);

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
              shape={data?.shape}
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

export function TablePanel({ panel, panels }: PanelBodyProps<TablePanelInfo>) {
  const data = panel.resultMeta || new PanelResult();

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

export const tablePanel: PanelUIDetails<TablePanelInfo> = {
  icon: 'table_chart',
  eval: evalTablePanel,
  id: 'table',
  label: 'Table',
  details: TablePanelDetails,
  body: TablePanel,
  alwaysOpen: true,
  previewable: false,
  factory: () => new TablePanelInfo(),
  hasStdout: false,
  info: null,
};
