import React from 'react';
import { ArrayShape, ObjectShape, Shape, shape } from 'shape';
import { MODE } from '../../shared/constants';
import { InvalidDependentPanelError } from '../../shared/errors';
import { LANGUAGES } from '../../shared/languages';
import { buildSQLiteQuery } from '../../shared/sql';
import {
  AggregateType,
  FilterAggregatePanelInfo,
  PanelInfo,
  PanelResult,
  TimeSeriesRange as TimeSeriesRangeT,
} from '../../shared/state';
import { title } from '../../shared/text';
import { panelRPC } from '../asyncRPC';
import { CodeEditor } from '../components/CodeEditor';
import { FieldPicker } from '../components/FieldPicker';
import { FormGroup } from '../components/FormGroup';
import { Input } from '../components/Input';
import { PanelSourcePicker } from '../components/PanelSourcePicker';
import { Select } from '../components/Select';
import { TimeSeriesRange } from '../components/TimeSeriesRange';
import { PanelDetailsProps, PanelUIDetails } from './types';

function withAggregateShape(
  r: PanelResult,
  p: FilterAggregatePanelInfo
): Shape | null {
  if (!r.shape) {
    return null;
  }

  if (r.shape.kind !== 'array') {
    return r.shape;
  }

  const array = r.shape as ArrayShape;
  if (array.children.kind !== 'object') {
    return r.shape;
  }

  const obj = array.children as ObjectShape;
  if (p.filagg.aggregateType !== 'none') {
    return {
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
    };
  }

  return r.shape;
}

export async function evalFilterAggregatePanel(
  panel: FilterAggregatePanelInfo,
  panels: Array<PanelInfo>
) {
  if (MODE === 'browser') {
    const panelIndex = (panels || []).findIndex(
      (p) => p.id === panel.filagg.panelSource
    );
    const resultMeta = (panels[panelIndex] || {}).resultMeta;
    if (!resultMeta || !resultMeta.value) {
      throw new InvalidDependentPanelError(panel.filagg.panelSource);
    }

    const idMap: Record<string | number, string> = {};
    panels.forEach((p, index) => {
      idMap[index] = p.id;
      idMap[p.name] = p.id;
    });
    const query = buildSQLiteQuery(panel, idMap);

    const panelResults: Record<string | number, PanelResult> = {};
    panels.forEach((p, index) => {
      panelResults[index] = p.resultMeta;
      panelResults[p.name] = p.resultMeta;
    });
    const language = LANGUAGES.sql;
    const res = await language.inMemoryEval(query, panelResults);
    const s = shape(res.value);
    return {
      ...res,
      size: res.value ? JSON.stringify(res.value).length : 0,
      arrayCount: s.kind === 'array' ? (res.value || []).length : null,
      contentType: 'application/json',
      shape: s,
    };
  }

  return await panelRPC('eval', panel.id);
}

export function FilterAggregatePanelDetails({
  panel,
  panels,
  updatePanel,
}: PanelDetailsProps<FilterAggregatePanelInfo>) {
  const data =
    ((panels || []).find((p) => p.id === panel.filagg.panelSource) || {})
      .resultMeta || new PanelResult();

  if (panels.length <= 1) {
    return (
      <p>
        This panel can only build on other panels. Create another panel first.
      </p>
    );
  }

  return (
    <React.Fragment>
      <FormGroup>
        <div className="form-row">
          <PanelSourcePicker
            currentPanel={panel.id}
            panels={panels}
            value={panel.filagg.panelSource}
            onChange={(value: string) => {
              panel.filagg.panelSource = value;
              updatePanel(panel);
            }}
          />
        </div>
        <div className="form-row">
          <CodeEditor
            singleLine
            id={panel.id + 'filter'}
            label="Filter"
            placeholder="x LIKE '%town%' AND y IN (1, 2)"
            value={panel.filagg.filter}
            onChange={(value: string) => {
              panel.filagg.filter = value;
              updatePanel(panel);
            }}
            language="sql"
            className="editor"
            tooltip="Use any valid SQLite WHERE expression."
          />
        </div>
        {MODE !== 'browser' && (
          <TimeSeriesRange
            shape={data.shape}
            range={panel.filagg.range}
            updateRange={(r: TimeSeriesRangeT) => {
              panel.filagg.range = r;
              updatePanel(panel);
            }}
            timeFieldTooltip={
              'Column must be a date field in ISO8601/RFC3339 format.'
            }
          />
        )}
      </FormGroup>
      <FormGroup>
        <div className="form-row">
          <Select
            label="Aggregate"
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
                shape={data?.shape}
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
                  shape={data?.shape}
                  value={panel.filagg.aggregateOn}
                  onChange={(value: string) => {
                    panel.filagg.aggregateOn = value;
                    updatePanel(panel);
                  }}
                />
              </div>
            )}
            {MODE !== 'browser' && (
              <div className="form-row">
                <Select
                  label="With Time Interval"
                  value={panel.filagg.windowInterval}
                  onChange={(value: string) => {
                    panel.filagg.windowInterval = value;
                    updatePanel(panel);
                  }}
                  tooltip={`If used, the above "Group by" column must be a date field in ISO8601/RFC3339 format.`}
                >
                  <optgroup label="None">
                    <option value="0">None</option>
                  </optgroup>
                  <optgroup label="Up to a day">
                    <option value="1">1 Minute</option>
                    <option value="5">5 Minutes</option>
                    <option value="15">15 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="60">1 Hour</option>
                    <option value="180">3 Hours</option>
                    <option value={String(60 * 6)}>6 Hours</option>
                    <option value={String(60 * 12)}>12 Hours</option>
                    <option value={String(60 * 24)}>1 Day</option>
                  </optgroup>
                  <optgroup label="Up to a month">
                    <option value={String(60 * 24 * 3)}>3 Days</option>
                    <option value={String(60 * 24 * 7)}>7 days</option>
                    <option value={String(60 * 24 * 7 * 2)}>14 days</option>
                    <option value={String(60 * 24 * 30)}>30 days</option>
                  </optgroup>
                  <optgroup label="Up to a year">
                    <option value={String(60 * 24 * 90)}>90 Days</option>
                    <option value={String(60 * 24 * 180)}>180 Days</option>
                    <option value={String(60 * 24 * 365)}>1 Year</option>
                  </optgroup>
                </Select>
              </div>
            )}
          </React.Fragment>
        )}
      </FormGroup>
      <FormGroup>
        <div className="form-row form-row--multi">
          <FieldPicker
            preferredDefaultType="number"
            label="Sort"
            data-test-id="sort-field"
            shape={withAggregateShape(data, panel)}
            value={panel.filagg.sortOn}
            onChange={(value: string) => {
              panel.filagg.sortOn = value;
              updatePanel(panel);
            }}
          />
          <Select
            data-test-id="sort-direction"
            label="Direction"
            value={panel.filagg.sortAsc ? 'asc' : 'desc'}
            onChange={(value: string) => {
              panel.filagg.sortAsc = value === 'asc';
              updatePanel(panel);
            }}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>
        </div>
        <div className="form-row">
          <Input
            label="Limit"
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

export const filaggPanel: PanelUIDetails<FilterAggregatePanelInfo> = {
  icon: 'search',
  eval: evalFilterAggregatePanel,
  id: 'filagg',
  label: 'Visual Transform',
  details: FilterAggregatePanelDetails,
  body: null,
  previewable: true,
  factory: (pageId: string) => new FilterAggregatePanelInfo(pageId),
  info: null,
  hasStdout: false,
};
