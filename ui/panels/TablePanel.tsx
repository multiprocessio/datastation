import { preview } from '@multiprocess/preview';
import { shape } from '@multiprocess/shape';
import * as React from 'react';
import { MODE } from '../../shared/constants';
import { InvalidDependentPanelError } from '../../shared/errors';
import {
  PanelInfo,
  PanelResult,
  TableColumn,
  TablePanelInfo,
} from '../../shared/state';
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
  panelSource: string,
  columns: Array<string>,
  _: Array<string>,
  panels: Array<PanelInfo>
) {
  if (MODE === 'browser') {
    const panelIndex = (panels || []).findIndex((p) => p.id === panelSource);
    const resultMeta = (panels[panelIndex] || {}).resultMeta;
    if (!resultMeta || !resultMeta.value) {
      throw new InvalidDependentPanelError(panelIndex);
    }
    const { value } = resultMeta;
    try {
      const valueWithRequestedColumns = columnsFromObject(
        value,
        columns,
        panelIndex
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
  panels: Array<PanelInfo>,
  indexIdMap: Array<string>
) {
  return evalColumnPanel(
    panel.id,
    panel.table.panelSource,
    panel.table.columns.map((c) => c.field),
    indexIdMap,
    panels
  );
}

export function TablePanelDetails({
  panel,
  panels,
  updatePanel,
}: PanelDetailsProps<TablePanelInfo>) {
  const data =
    ((panels || []).find((p) => p.id === panel.table.panelSource) || {})
      .resultMeta || new PanelResult();
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
            onChange={(value: string) => {
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

  // column key is (field + i) everywhere because columns can be
  // duplicated. Maybe should assign a uuid to them instead
  return (
    <table>
      <thead>
        <tr>
          {panel.table.columns.map((column: TableColumn, i: number) => (
            <th key={column.field + i}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {valueAsArray.map((row: any) => (
          /* probably a better way to do this... */ <tr
            key={Object.values(row).join(',')}
          >
            {panel.table.columns.map((column: TableColumn, i: number) => (
              <td key={column.field + i}>{row[column.field]}</td>
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
  previewable: false,
  factory: () => new TablePanelInfo(),
  hasStdout: false,
  info: null,
  dashboard: true,
};
