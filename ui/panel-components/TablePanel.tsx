import { preview } from 'preview';
import * as React from 'react';
import { shape } from 'shape';
import { MODE, RPC } from '../../shared/constants';
import { InvalidDependentPanelError } from '../../shared/errors';
import { EvalColumnsBody } from '../../shared/rpc';
import { PanelResult, TableColumn, TablePanelInfo } from '../../shared/state';
import { columnsFromObject } from '../../shared/table';
import { asyncRPC } from '../asyncRPC';
import { Alert } from '../component-library/Alert';
import { Button } from '../component-library/Button';
import { FieldPicker, unusedFields } from '../component-library/FieldPicker';
import { FormGroup } from '../component-library/FormGroup';
import { PanelSourcePicker } from '../component-library/PanelSourcePicker';
import {
  guardPanel,
  PanelBodyProps,
  PanelDetailsProps,
  PanelUIDetails,
} from './types';

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

  return await asyncRPC<EvalColumnsBody, void, PanelResult>(
    RPC.EVAL_COLUMNS,
    null,
    {
      id: indexIdMap[panelSource],
      columns,
      panelSource,
    }
  );
}

export function evalTablePanel(
  panel: TablePanelInfo,
  panelResults: Array<PanelResult>,
  indexIdMap: Array<string>
) {
  return evalColumnPanel(
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
}: PanelDetailsProps) {
  const tp = guardPanel<TablePanelInfo>(panel, 'table');
  const data =
    (panels[tp.graph.panelSource] || {}).resultMeta || new PanelResult();
  React.useEffect(() => {
    const fields = unusedFields(data, ...tp.table.columns.map((c) => c.field));

    if (fields) {
      tp.table.columns.push({ label: '', field: '' });
      updatePanel(tp);
    }
  }, [tp.table.panelSource, data]);

  return (
    <React.Fragment>
      <FormGroup label="General">
        <div className="form-row">
          <PanelSourcePicker
            currentPanel={tp.id}
            panels={panels}
            value={tp.table.panelSource}
            onChange={(value: number) => {
              tp.table.panelSource = value;
              updatePanel(tp);
            }}
          />
        </div>
      </FormGroup>
      <FormGroup label="Columns">
        {tp.table.columns.map((c, i) => (
          <div className="form-row vertical-align-center" key={c.field + i}>
            <FieldPicker
              used={tp.table.columns.map((c) => c.field)}
              onDelete={() => {
                tp.table.columns.splice(i, 1);
                updatePanel(tp);
              }}
              label="Field"
              value={c.field}
              panelSourceResult={data}
              onChange={(value: string) => {
                c.field = value;
                updatePanel(tp);
              }}
              labelValue={c.label}
              labelOnChange={(value: string) => {
                c.label = value;
                updatePanel(tp);
              }}
            />
          </div>
        ))}
        <Button
          onClick={() => {
            tp.table.columns.push({ label: '', field: '' });
            updatePanel(tp);
          }}
        >
          Add Column
        </Button>
      </FormGroup>
    </React.Fragment>
  );
}

export function TablePanel({ panel, panels }: PanelBodyProps) {
  const tp = guardPanel<TablePanelInfo>(panel, 'table');
  const data =
    (panels[tp.graph.panelSource] || {}).resultMeta || new PanelResult();

  let valueAsArray: Array<any> = [];
  if (data && data.value && Array.isArray(data.value)) {
    valueAsArray = data.value;
  }

  if (!tp.table.columns || !tp.table.columns.length) {
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
          {tp.table.columns.map((column: TableColumn) => (
            <th key={column.field}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {valueAsArray.map((row: any, i: number) => (
          <tr key={i}>
            {tp.table.columns.map((column: TableColumn) => (
              <td key={column.field}>{row[column.field]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const tablePanel: PanelUIDetails = {
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
  killable: true,
};
