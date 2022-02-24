import Chart from 'chart.js/auto';
import { preview } from 'preview';
import * as React from 'react';
import log from '../../shared/log';
import {
  GraphField,
  GraphPanelInfo,
  GraphPanelInfoType,
  PanelInfo,
  PanelInfoWidth,
  PanelResult,
} from '../../shared/state';
import { Button } from '../components/Button';
import {
  allFields,
  FieldPicker,
  unusedFields,
} from '../components/FieldPicker';
import { FormGroup } from '../components/FormGroup';
import { PanelSourcePicker } from '../components/PanelSourcePicker';
import { Radio } from '../components/Radio';
import { NONE, Select } from '../components/Select';
import { SettingsContext } from '../Settings';
import { evalColumnPanel } from './TablePanel';
import { PanelBodyProps, PanelDetailsProps, PanelUIDetails } from './types';

export function evalGraphPanel(
  panel: GraphPanelInfo,
  panels: Array<PanelInfo>,
  idMap: Record<string | string, string>
) {
  return evalColumnPanel(
    panel.id,
    panel.graph.panelSource,
    [panel.graph.x, ...panel.graph.ys.map((y) => y.field)],
    idMap,
    panels
  );
}

// Adapted from: https://sashamaps.net/docs/resources/20-colors/
const UNIQUE_COLORS = [
  '#4363d8',
  '#3cb44b',
  '#ffe119',
  '#e6194b',
  '#f58231',
  '#911eb4',
  '#46f0f0',
  '#f032e6',
  '#bcf60c',
  '#fabebe',
  '#008080',
  '#e6beff',
  '#9a6324',
  '#fffac8',
  '#800000',
  '#aaffc3',
  '#808000',
  '#ffd8b1',
  '#000075',
  '#808080',
  '#ffffff',
  '#000000',
];

function transparentize(hex: string, alpha: number) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function fixedColorByLabel(valueLabels: Array<string>) {
  const copyOfValueLabels = [...valueLabels]; // So we can sort this

  // Assign colors based on labels alphabetic order
  const colorsSortedByLabelAlphabeticOrder = copyOfValueLabels
    .sort()
    .map((label, i) => ({ label, color: UNIQUE_COLORS[i] }));
  // Then resort based on label real order. This keeps colors
  // consistent for the same label even as the order of labels changes
  const colorsSortedByRealLabelOrder = colorsSortedByLabelAlphabeticOrder
    .sort((a, b) => valueLabels.indexOf(a.label) - valueLabels.indexOf(b.label))
    .map((c) => c.color);
  return {
    backgroundColor: colorsSortedByRealLabelOrder.map((c) =>
      transparentize(c, 0.75)
    ),
    borderColor: colorsSortedByRealLabelOrder,
  };
}

function getPieDatasets(
  panel: GraphPanelInfo,
  value: Array<any>,
  ys: Array<GraphField>
): { labels: string[]; datasets: any[]; legendLabels: any } {
  const labels = value.map((d) => d[panel.graph.x]);
  const datasets = ys.map(({ field, label }, i) => {
    return {
      label,
      data: value.map((d) => +d[field]),
      ...fixedColorByLabel(labels),
      tooltip: {
        callbacks:
          panel.graph.type === 'pie'
            ? {
                label: (ctx: any) => {
                  const reversedIndex = ys.length - ctx.datasetIndex - 1;
                  // Explicitly do read from the not-reversed panel.graph.ys array.
                  // This library stacks levels in reverse of what you'd expect.
                  const serieses = panel.graph.ys.slice(0, reversedIndex + 1);
                  const labels = serieses.map(
                    ({ label, field }) =>
                      `${label}: ${+value[ctx.dataIndex][field]}`
                  );
                  labels.unshift(ctx.label);
                  return labels;
                },
              }
            : undefined,
      },
    };
  });

  return { labels, datasets, legendLabels: undefined };
}

function getLineDatasets(
  panel: GraphPanelInfo,
  value: Array<any>,
  ys: Array<GraphField>,
  uniqueBy?: string
): { labels: string[]; datasets: any[]; legendLabels: any } {
  if (uniqueBy === NONE) {
    const labels = value.map((d) => d[panel.graph.x]);
    let legendLabels = undefined;

    // NOTE: ys.length should always be 1 here
    const datasets = ys.map(({ field, label }) => {
      let backgroundColor: string | string[] = transparentize(
        UNIQUE_COLORS[0],
        0.75
      );
      let borderColor: string | string[] = UNIQUE_COLORS[0];

      // Override when it is a bar chart with unique colors per column
      if (panel.graph.type !== 'line' && panel.graph.colors.unique) {
        ({ backgroundColor, borderColor } = fixedColorByLabel(labels));
        legendLabels = {
          generateLabels() {
            return labels.map((l, i) => ({
              text: l,
              strokeStyle: borderColor[i],
              fillStyle: backgroundColor[i],
            }));
          },
        };
      }

      return {
        label,
        data: value.map((d) => +d[field]),
        backgroundColor,
        borderColor,
        borderWidth: 2,
      };
    });
    return { labels, datasets, legendLabels };
  }

  const uniques: Record<string, Array<any>> = {};
  for (const row of value) {
    if (!uniques[row[uniqueBy]]) {
      uniques[row[uniqueBy]] = [];
    }

    uniques[row[uniqueBy]].push(row);
  }

  const datasets = Object.entries(uniques).map(([unique, values], i) => {
    return {
      label: unique,
      data: values.map((d) => +d[ys[0].field]),
      backgroundColor: transparentize(
        UNIQUE_COLORS[i % UNIQUE_COLORS.length],
        0.75
      ),
      borderColor: UNIQUE_COLORS[i % UNIQUE_COLORS.length],
      borderWidth: 2,
    };
  });

  const labels = Object.values(uniques)[0].map((d) => d[panel.graph.x]);
  return { datasets, labels, legendLabels: undefined };
}

export function GraphPanel({ panel }: PanelBodyProps<GraphPanelInfo>) {
  const {
    state: { theme },
  } = React.useContext(SettingsContext);
  const data = panel.resultMeta || new PanelResult();
  const value = (data || {}).value || [];
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref || !value || !value.length) {
      return;
    }

    if (!Array.isArray(value)) {
      log.error(
        `Expected array input to graph, got (${typeof value}): ` +
          preview(value)
      );
      return;
    }

    // Only doesn't exist in tests
    const parent = ref.current.closest('.panel-body');
    let background = 'white';
    if (parent) {
      const style = window.getComputedStyle(parent);
      background = style.getPropertyValue('background-color');
      // TODO: don't hardcode this
      Chart.defaults.color = theme === 'light' || !theme ? 'black' : 'white';
    }

    let ys = [...panel.graph.ys];
    if (panel.graph.type === 'pie') {
      ys.reverse();
    }

    const { datasets, labels, legendLabels } =
      panel.graph.type === 'pie'
        ? getPieDatasets(panel, value, ys)
        : getLineDatasets(panel, value, ys, panel.graph.uniqueBy);

    const ctx = ref.current.getContext('2d');
    const chart = new Chart(ctx, {
      plugins: [
        {
          id: 'background-of-chart',
          // Pretty silly there's no builtin way to set a background color
          // https://stackoverflow.com/a/38493678/1507139
          beforeDraw: function () {
            if (!ref || !ref.current) {
              return;
            }

            ctx.save();
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, ref.current.width, ref.current.height);
            ctx.restore();
          },
        },
      ],
      options: {
        animation: {
          duration: 0,
        },
        responsive: true,
        scales:
          ys.length === 1
            ? { y: { title: { display: true, text: ys[0].label } } }
            : undefined,
        plugins: {
          legend: {
            title: {
              display: true,
              text: panel.name,
            },
            labels: legendLabels,
          },
        },
      },
      type: panel.graph.type,
      data: {
        labels,
        datasets,
      },
    });

    return () => chart.destroy();
  }, [
    ref.current,
    data,
    panel.name,
    panel.graph.x,
    panel.graph.ys,
    panel.graph.type,
    panel.graph.colors.unique,
    panel.graph.width,
    theme,
  ]);

  if (!value || !value.length) {
    return null;
  }

  return <canvas className={`canvas--${panel.graph.width}`} ref={ref} />;
}

export function GraphPanelDetails({
  panel,
  panels,
  updatePanel,
}: PanelDetailsProps<GraphPanelInfo>) {
  const data =
    (panels.find((p) => p.id === panel.graph.panelSource) || {}).resultMeta ||
    new PanelResult();

  React.useEffect(() => {
    if (panel.graph.ys.length) {
      return;
    }

    const fields = unusedFields(
      data?.shape,
      panel.graph.x,
      ...panel.graph.ys.map((y) => y.field)
    );

    if (fields) {
      panel.graph.ys.push({ label: '', field: '' });
      updatePanel(panel);
    }
  });

  let moreThan2Fields = allFields(data?.shape).length > 2;

  return (
    <React.Fragment>
      <div className="flex">
        <div>
          <FormGroup>
            <div className="form-row">
              <PanelSourcePicker
                currentPanel={panel.id}
                panels={panels}
                value={panel.graph.panelSource}
                onChange={(value: string) => {
                  panel.graph.panelSource = value;
                  updatePanel(panel);
                }}
              />
            </div>
            <div className="form-row">
              <Radio
                label="Width"
                value={panel.graph.width}
                onChange={(value: string) => {
                  panel.graph.width = value as PanelInfoWidth;
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
            <div className="form-row">
              <FieldPicker
                label={panel.graph.type === 'pie' ? 'Slice' : 'X-Axis'}
                shape={data?.shape}
                value={panel.graph.x}
                onChange={(value: string) => {
                  panel.graph.x = value;
                  updatePanel(panel);
                }}
              />
            </div>
            {panel.graph.ys.map((y, i) => (
              <div
                className="form-row form-row--multi vertical-align-center"
                key={y.field + i}
              >
                <FieldPicker
                  used={[...panel.graph.ys.map((y) => y.field), panel.graph.x]}
                  onDelete={
                    panel.graph.ys.length > 1
                      ? () => {
                          panel.graph.ys.splice(i, 1);
                          updatePanel(panel);
                        }
                      : undefined
                  }
                  preferredDefaultType="number"
                  label="Value"
                  value={y.field}
                  shape={data?.shape}
                  onChange={(value: string) => {
                    y.field = value;
                    updatePanel(panel);
                  }}
                  labelValue={y.label}
                  labelOnChange={(value: string) => {
                    y.label = value;
                    updatePanel(panel);
                  }}
                />
              </div>
            ))}
            {panel.graph.type === 'pie' ? (
              <Button
                onClick={() => {
                  panel.graph.ys.push({ label: '', field: '' });
                  updatePanel(panel);
                }}
              >
                Add Series
              </Button>
            ) : null}
            {panel.graph.type !== 'pie' ? (
              <>
                {moreThan2Fields ? (
                  <div className="form-row">
                    <FieldPicker
                      allowNone={NONE}
                      label="Unique by"
                      shape={data?.shape}
                      value={panel.graph.uniqueBy}
                      onChange={(value: string) => {
                        panel.graph.uniqueBy = value;
                        updatePanel(panel);
                      }}
                    />
                  </div>
                ) : null}
                {panel.graph.type === 'bar' && panel.graph.uniqueBy === NONE ? (
                  <div className="form-row">
                    <Radio
                      label="Unique colors"
                      value={String(panel.graph.colors.unique)}
                      onChange={(value: string) => {
                        panel.graph.colors.unique = value === 'true';
                        updatePanel(panel);
                      }}
                      options={[
                        { label: 'Yes', value: 'true' },
                        { label: 'No', value: 'false' },
                      ]}
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </FormGroup>
        </div>
        <div>
          <FormGroup>
            <div className="form-row">
              <Select
                label="Graph Type"
                value={panel.graph.type}
                onChange={(value: string) => {
                  panel.graph.type = value as GraphPanelInfoType;
                  updatePanel(panel);
                }}
              >
                <option value="line">Line Chart</option>
                <option value="bar">Bar Chart</option>
                <option value="pie">Pie Chart</option>
              </Select>
            </div>
          </FormGroup>
        </div>
      </div>
    </React.Fragment>
  );
}

export const graphPanel: PanelUIDetails<GraphPanelInfo> = {
  icon: 'bar_chart',
  eval: evalGraphPanel,
  id: 'graph',
  label: 'Graph',
  details: GraphPanelDetails,
  body: GraphPanel,
  previewable: false,
  factory: () => new GraphPanelInfo(),
  hasStdout: false,
  info: null,
  dashboard: true,
};
