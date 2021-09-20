import React from 'react';
import { ArrayShape, ObjectShape, shape, Shape } from 'shape';
import { MODE, RPC } from '../shared/constants';
import { InvalidDependentPanelError } from '../shared/errors';
import { LANGUAGES } from '../shared/languages';
import { FilterAggregateEvalBody } from '../shared/rpc';
import {
  AggregateType,
  FilterAggregatePanelInfo,
  PanelInfo,
  PanelResult,
} from '../shared/state';
import { title } from '../shared/text';
import { asyncRPC } from './asyncRPC';
import { CodeEditor } from './component-library/CodeEditor';
import { FormGroup } from './component-library/FormGroup';
import { Input } from './component-library/Input';
import { Select } from './component-library/Select';
import { FieldPicker } from './FieldPicker';
import { PanelSourcePicker } from './PanelSourcePicker';

function withAggregateShape(
  r: PanelResult,
  p: FilterAggregatePanelInfo
): PanelResult {
  if (r.shape.kind !== 'array') {
    return r;
  }

  const array = r.shape as ArrayShape;
  if (array.children.kind !== 'object') {
    return r;
  }

  const obj = array.children as ObjectShape;
  if (p.filagg.aggregateType !== 'none') {
    return {
      ...p,
      shape: {
        ...array,
        children: {
          ...obj,
          children: {
            ...obj.children,
            ['Aggregate: ' + title(p.filagg.aggregateType)]: {
              kind: 'scalar',
              name: 'number',
            },
          },
        },
      },
    };
  }

  return p;
}

export async function evalFilterAggregatePanel(
  panel: FilterAggregatePanelInfo,
  indexIdMap: Array<string>,
  panelResults: Array<PanelResult>,
  indexShapeMap: Array<Shape>
) {
  if (MODE === 'browser') {
    const {
      panelSource,
      aggregateType,
      aggregateOn,
      groupBy,
      filter,
      sortOn,
      sortAsc,
      limit,
    } = panel.filagg;

    if (!panelResults || !panelResults[panelSource]) {
      throw new InvalidDependentPanelError(panelSource);
    }

    let columns = '*';
    let groupByClause = '';
    if (aggregateType !== 'none') {
      columns = `\`${groupBy}\`, ${aggregateType.toUpperCase()}(${
        aggregateOn ? '`' + aggregateOn + '`' : 1
      }) AS \`${aggregateType}\``;
      groupByClause = `GROUP BY \`${groupBy}\``;
    }
    const whereClause = filter ? 'WHERE ' + filter : '';
    let sort = sortOn;
    if ((sortOn || '').startsWith('Aggregate: ')) {
      sort = `${aggregateType.toUpperCase()}(${
        aggregateOn ? '`' + aggregateOn + '`' : 1
      })`;
    }
    const orderByClause = `ORDER BY ${sort} ${sortAsc ? 'ASC' : 'DESC'}`;
    const query = `SELECT ${columns} FROM DM_getPanel(${panelSource}) ${whereClause} ${groupByClause} ${orderByClause} LIMIT ${limit}`;

    const language = LANGUAGES.sql;
    const res = await language.inMemoryEval(query, panelResults);
    return {
      ...res,
      size: res.value ? JSON.stringify(res.value).length : 0,
      contentType: 'application/json',
      shape: shape(res.value),
    };
  }

  return await asyncRPC<FilterAggregateEvalBody, void, PanelResult>(
    RPC.EVAL_FILTER_AGGREGATE,
    null,
    {
      ...panel,
      indexIdMap,
      indexShapeMap,
    }
  );
}

export function FilterAggregatePanelDetails({
  panel,
  panels,
  updatePanel,
  data,
}: {
  panel: FilterAggregatePanelInfo;
  panels: Array<PanelInfo>;
  updatePanel: (d: FilterAggregatePanelInfo) => void;
  data: PanelResult;
}) {
  return (
    <React.Fragment>
      <FormGroup label="General">
        <div className="form-row">
          <PanelSourcePicker
            currentPanel={panel.id}
            panels={panels}
            value={panel.filagg.panelSource}
            onChange={(value: number) => {
              panel.filagg.panelSource = value;
              updatePanel(panel);
            }}
          />
        </div>
      </FormGroup>
      <FormGroup label="Filter">
        <div className="form-row">
          <CodeEditor
            singleLine
            id={panel.id + 'filter'}
            label="Expression"
            placeholder="x LIKE '%town%' AND y IN (1, 2)"
            value={panel.filagg.filter}
            onChange={(value: string) => {
              panel.filagg.filter = value;
              updatePanel(panel);
            }}
            language="sql"
            className="editor"
          />
        </div>
      </FormGroup>
      <FormGroup label="Aggregate">
        <div className="form-row">
          <Select
            label="Function"
            value={panel.filagg.aggregateType}
            onChange={(value: string) => {
              panel.filagg.aggregateType = value as AggregateType;
              updatePanel(panel);
            }}
          >
            <optgroup label="Disabled">
              <option value="none">None</option>
            </optgroup>
            <optgroup label="Enabled">
              <option value="count">Count</option>
              <option value="sum">Sum</option>
              <option value="average">Average</option>
              <option value="min">Min</option>
              <option value="max">Max</option>
            </optgroup>
          </Select>
        </div>
        {panel.filagg.aggregateType !== 'none' && (
          <React.Fragment>
            <div className="form-row">
              <FieldPicker
                preferredDefaultType="string"
                label="Group by"
                panelSourceResult={data}
                value={panel.filagg.groupBy}
                onChange={(value: string) => {
                  panel.filagg.groupBy = value;
                  updatePanel(panel);
                }}
              />
            </div>
            {panel.filagg.aggregateType !== 'count' && (
              <div className="form-row">
                <FieldPicker
                  preferredDefaultType="number"
                  label={title(panel.filagg.aggregateType) + ' on'}
                  panelSourceResult={data}
                  value={panel.filagg.aggregateOn}
                  onChange={(value: string) => {
                    panel.filagg.aggregateOn = value;
                    updatePanel(panel);
                  }}
                />
              </div>
            )}
          </React.Fragment>
        )}
      </FormGroup>
      <FormGroup label="Sort">
        <div className="form-row">
          <FieldPicker
            preferredDefaultType="number"
            label="Field"
            panelSourceResult={withAggregateShape(data, panel)}
            value={panel.filagg.sortOn}
            onChange={(value: string) => {
              panel.filagg.sortOn = value;
              updatePanel(panel);
            }}
          />
          <Select
            label="Direction"
            value={panel.filagg.aggregateType}
            onChange={(value: string) => {
              panel.filagg.sortAsc = value === 'asc';
              updatePanel(panel);
            }}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>
        </div>
      </FormGroup>
      <FormGroup label="Limit">
        <div className="form-row">
          <Input
            onChange={(value: string) => {
              panel.filagg.limit = +value;
              updatePanel(panel);
            }}
            value={String(panel.filagg.limit)}
            min={1}
            type="number"
          />
        </div>
      </FormGroup>
    </React.Fragment>
  );
}
