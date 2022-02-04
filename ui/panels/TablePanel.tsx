import { preview } from 'preview';
import { Radio } from '../components/Radio';
import * as React from 'react';
import { shape } from 'shape';
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
  _: Record<string | number, string>,
  panels: Array<PanelInfo>
) {
  if (MODE === 'browser') {
    const panelIndex = (panels || []).findIndex(function findIndex(p) {
      return p.id === panelSource;
    });
    const resultMeta = (panels[panelIndex] || {}).resultMeta;
    if (!resultMeta || !resultMeta.value) {
      throw new InvalidDependentPanelError(panelSource);
    }
    const { value } = resultMeta;
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

function mapColumnToField(c: TableColumn) {
  return c.field;
}

export function evalTablePanel(
  panel: TablePanelInfo,
  panels: Array<PanelInfo>,
  idMap: Record<string | number, string>
) {
  return evalColumnPanel(
    panel.id,
    panel.table.panelSource,
    panel.table.columns.map(mapColumnToField),
    idMap,
    panels
  );
}

export function TablePanelDetails({
  panel,
  panels,
  updatePanel,
}: PanelDetailsProps<TablePanelInfo>) {
  const data =
    (
      (panels || []).find(function mapPanelsToResults(p) {
        return p.id === panel.table.panelSource;
      }) || {}
    ).resultMeta || new PanelResult();
  React.useEffect(
    function addInitialFields() {
      const fields = unusedFields(
        data?.shape,
        ...panel.table.columns.map(mapColumnToField)
      );

      if (fields) {
        panel.table.columns.push({ label: '', field: '' });
        updatePanel(panel);
      }
    },
    [panel.table.panelSource, data]
  );

  return (
    <React.Fragment>
      <FormGroup>
        <div className="form-row">
          <PanelSourcePicker
            currentPanel={panel.id}
            panels={panels}
            value={panel.table.panelSource}
            onChange={function handlePanelSourceChange(value: string) {
              panel.table.panelSource = value;
              updatePanel(panel);
            }}
          />
        </div>
        <div className="form-row">
              <Radio
                label="Width"
                value={panel.table.width}
                onChange={(value: string) => {
                  panel.table.width = value as PanelInfoWidth;
                  updatePanel(panel);
                }}
                options={[
                  { label: 'Default', value: 'small' },
                  { label: '75%', value: 'medium' },
                  { label: '100%', value: 'large' },
                ]}
              />
            </div>
      </FormGroup>
      <FormGroup>
        {panel.table.columns.map(function mapColumnRender(c, i) {
          return (
            <div className="form-row form-row--multi vertical-align-center" key={c.field + i}>
              <FieldPicker
                used={panel.table.columns.map(mapColumnToField)}
                onDelete={panel.table.columns.length > 1 ? function handleColumnDelete() {
                  panel.table.columns.splice(i, 1);
                  updatePanel(panel);
                }: undefined}
                label="Column"
                value={c.field}
                shape={data?.shape}
                onChange={function handleFieldChange(value: string) {
                  c.field = value;
                  updatePanel(panel);
                }}
                labelValue={c.label}
                labelOnChange={function handleFieldLabelChange(value: string) {
                  c.label = value;
                  updatePanel(panel);
                }}
              />
            </div>
          );
        })}
        <Button
          onClick={function handleAddColumn() {
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
    <table className={`table table--${panel.table.width}`}>
      <thead>
        <tr>
          {panel.table.columns.map(function mapColumnToHeader(
            column: TableColumn,
            i: number
          ) {
            return <th key={column.field + i}>{column.label}</th>;
          })}
        </tr>
      </thead>
      <tbody>
        {valueAsArray.map(function mapRows(row: any) {
          return (
            /* probably a better way to do this... */ <tr
              key={Object.values(row).join(',')}
            >
              {panel.table.columns.map(function mapColumnToCell(
                column: TableColumn,
                i: number
              ) {
                return <td key={column.field + i}>{row[column.field]}</td>;
              })}
            </tr>
          );
        })}
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
  factory: function () {
    return new TablePanelInfo();
  },
  hasStdout: false,
  info: null,
  dashboard: true,
};
