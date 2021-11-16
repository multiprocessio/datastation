import Chart from 'chart.js/auto';
import { preview } from 'preview';
import * as React from 'react';
import log from '../../shared/log';
import {
  GraphField,
  GraphPanelInfo,
  GraphPanelInfoType,
  GraphPanelInfoWidth,
  PanelInfo,
  PanelResult,
} from '../../shared/state';
import { Button } from '../components/Button';
import { FieldPicker, unusedFields } from '../components/FieldPicker';
import { FormGroup } from '../components/FormGroup';
import { PanelSourcePicker } from '../components/PanelSourcePicker';
import { Radio } from '../components/Radio';
import { Select } from '../components/Select';
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

// Generated by https://medialab.github.io/iwanthue/
const COLORS = [
  '#57cb9d',
  '#e541a0',
  '#5ec961',
  '#7857cc',
  '#a3be37',
  '#cd6ddb',
  '#51a531',
  '#af3a99',
  '#487f24',
  '#647de2',
  '#c9b233',
  '#8753a5',
  '#e59a31',
  '#5a6bac',
  '#df6a28',
  '#5fa2da',
  '#d2442d',
  '#42c0c7',
  '#e22959',
  '#389051',
  '#e268a8',
  '#879936',
  '#c194dd',
  '#596d18',
  '#bb3668',
  '#41a386',
  '#ec516b',
  '#277257',
  '#bc3740',
  '#83b571',
  '#934270',
  '#beb96d',
  '#9a5a93',
  '#be9637',
  '#c174a0',
  '#367042',
  '#e57177',
  '#527436',
  '#ec95af',
  '#716615',
  '#974863',
  '#948948',
  '#98434a',
  '#666630',
  '#e1856f',
  '#95632e',
  '#b56364',
  '#d69e6c',
  '#a74c28',
  '#d98048',
];
function getNDifferentColors(
  n: number,
  groups: number,
  group: number
): Array<string> {
  const colors: Array<string> = [];
  const offset = groups * group;
  while (n) {
    colors.push(COLORS[(offset + n) % COLORS.length]);
    n--;
  }
  return colors;
}

function colorForDataset(
  ys: Array<GraphField>,
  graphType: GraphPanelInfoType | undefined,
  unique: boolean,
  valueLabels: Array<string>,
  field: string
): string | string[] {
  const colors = getNDifferentColors(
    ys.length > 1 ? ys.length : valueLabels.length,
    1,
    0
  );

  // This is the multiple Y-es case. Color needs to be consistent
  // across _field_.  Multiple Y-es isn't a thing for pie graphs
  // though.
  if (ys.length > 1 && graphType !== 'pie') {
    // This keeps color consistent for a field name even as the order
    // of the field may change.
    const sortedFields = ys.map((y) => y.field).sort();
    const index = sortedFields.indexOf(field);
    return colors[index];
  }

  if (!unique) {
    return colors[0];
  }

  const copyOfValueLabels = [...valueLabels]; // So we can sort this

  // Assign colors based on labels alphabetic order
  const colorsSortedByLabelAlphabeticOrder = copyOfValueLabels
    .sort()
    .map((label, i) => ({ label, color: colors[i] }));
  // Then resort based on label real order. This keeps colors
  // consistent for the same label even as the order of labels changes
  const colorsSortedByRealLabelOrder = colorsSortedByLabelAlphabeticOrder
    .sort((a, b) => valueLabels.indexOf(a.label) - valueLabels.indexOf(b.label))
    .map((c) => c.color);
  return colorsSortedByRealLabelOrder;
}

// SOURCE: https://stackoverflow.com/a/13532993/1507139
function shadeRGBPercent(color: string, percent: number) {
  let R = parseInt(color.substring(1, 3), 16);
  let G = parseInt(color.substring(3, 5), 16);
  let B = parseInt(color.substring(5, 7), 16);

  R = Math.floor((R * (100 + percent)) / 100);
  G = Math.floor((G * (100 + percent)) / 100);
  B = Math.floor((B * (100 + percent)) / 100);

  R = R < 255 ? R : 255;
  G = G < 255 ? G : 255;
  B = B < 255 ? B : 255;

  const RR = R.toString(16).length == 1 ? '0' + R.toString(16) : R.toString(16);
  const GG = G.toString(16).length == 1 ? '0' + G.toString(16) : G.toString(16);
  const BB = B.toString(16).length == 1 ? '0' + B.toString(16) : B.toString(16);

  console.log(RR, GG, BB);
  return '#' + RR + GG + BB;
}

export function GraphPanel({ panel, panels }: PanelBodyProps<GraphPanelInfo>) {
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

    const ys = [...panel.graph.ys];
    if (panel.graph.type === 'pie') {
      ys.reverse();
    }

    const labels = value.map((d) => d[panel.graph.x]);

    const ctx = ref.current.getContext('2d');
    const chart = new Chart(ctx, {
      plugins: [
        {
          id: 'background-white',
          // Pretty silly there's no builtin way to set a background color
          // https://stackoverflow.com/a/38493678/1507139
          beforeDraw: function () {
            if (!ref || !ref.current) {
              return;
            }

            ctx.save();
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, ref.current.width, ref.current.height);
            ctx.restore();
          },
        },
      ],
      options: {
        scales:
          ys.length === 1
            ? { y: { title: { display: true, text: ys[0].label } } }
            : undefined,
        responsive: true,
        plugins: {
          legend: {
            title: {
              display: true,
              text: panel.name,
            },
            labels: {
              // Hide legend unless there are multiple Y-es
              generateLabels:
                panel.graph.ys.length < 2 ? ((() => '') as any) : undefined,
            },
          },
        },
      },
      type: panel.graph.type,
      data: {
        labels,
        datasets: ys.map(({ field, label }) => {
          const backgroundColor = colorForDataset(
            ys,
            panel.graph.type,
            panel.graph.colors.unique,
            labels,
            field
          );

          const borderColor = Array.isArray(backgroundColor)
            ? backgroundColor.map((c) => shadeRGBPercent(c, -20))
            : shadeRGBPercent(backgroundColor, -20);

          return {
            label,
            data: value.map((d) => +d[field]),
            backgroundColor,
            borderColor,
            borderWidth: 2,
            tooltip: {
              callbacks:
                panel.graph.type === 'pie'
                  ? {
                      label: (ctx: any) => {
                        const reversedIndex = ys.length - ctx.datasetIndex - 1;
                        // Explicitly do read from the not-reversed panel.graph.ys array.
                        // This library stacks levels in reverse of what you'd expect.
                        const serieses = panel.graph.ys.slice(
                          0,
                          reversedIndex + 1
                        );
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
        }),
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

  return (
    <React.Fragment>
      <div className="flex">
        <div>
          <FormGroup label="General">
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
          </FormGroup>
          <FormGroup label={panel.graph.type === 'pie' ? 'Slice' : 'X-Axis'}>
            <div className="form-row">
              <FieldPicker
                label="Field"
                shape={data?.shape}
                value={panel.graph.x}
                onChange={(value: string) => {
                  panel.graph.x = value;
                  updatePanel(panel);
                }}
              />
            </div>
          </FormGroup>
          <FormGroup
            label={
              panel.graph.type === 'pie' ? 'Slice Size Series' : 'Y-Axis Series'
            }
          >
            {panel.graph.ys.map((y, i) => (
              <div className="form-row vertical-align-center" key={y.field + i}>
                <FieldPicker
                  used={[...panel.graph.ys.map((y) => y.field), panel.graph.x]}
                  onDelete={() => {
                    panel.graph.ys.splice(i, 1);
                    updatePanel(panel);
                  }}
                  preferredDefaultType="number"
                  label="Field"
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
            <Button
              onClick={() => {
                panel.graph.ys.push({ label: '', field: '' });
                updatePanel(panel);
              }}
            >
              Add Series
            </Button>
          </FormGroup>
        </div>
        <div>
          <FormGroup label="Display">
            <div className="form-row">
              <Select
                label="Graph Type"
                value={panel.graph.type}
                onChange={(value: string) => {
                  panel.graph.type = value as GraphPanelInfoType;
                  updatePanel(panel);
                }}
              >
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
                <option value="pie">Pie Chart</option>
              </Select>
            </div>
            <div className="form-row">
              <Radio
                label="Unique Colors"
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
            <div className="form-row">
              <Radio
                label="Width"
                value={panel.graph.width}
                onChange={(value: string) => {
                  panel.graph.width = value as GraphPanelInfoWidth;
                  updatePanel(panel);
                }}
                options={[
                  { label: 'Small', value: 'small' },
                  { label: 'Medium', value: 'medium' },
                  { label: 'Large', value: 'large' },
                ]}
              />
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
