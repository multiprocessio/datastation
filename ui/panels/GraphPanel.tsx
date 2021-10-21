import Chart from 'chart.js/auto';
import { preview } from 'preview';
import * as React from 'react';
import log from '../../shared/log';
import {
  GraphPanelInfo,
  GraphPanelInfoType,
  PanelInfo,
  PanelResult,
} from '../../shared/state';
import { Button } from '../components/Button';
import { FieldPicker, unusedFields } from '../components/FieldPicker';
import { FormGroup } from '../components/FormGroup';
import { PanelSourcePicker } from '../components/PanelSourcePicker';
import { Select } from '../components/Select';
import { evalColumnPanel } from './TablePanel';
import { PanelBodyProps, PanelDetailsProps, PanelUIDetails } from './types';

export function evalGraphPanel(
  panel: GraphPanelInfo,
  panels: Array<PanelInfo>,
  indexIdMap: Array<string>
) {
  return evalColumnPanel(
    panel.id,
    panel.graph.panelSource,
    [panel.graph.x, ...panel.graph.ys.map((y) => y.field)],
    indexIdMap,
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

    const colors = getNDifferentColors(
      ys.length > 1 ? ys.length : value.length,
      1,
      0
    );

    const ctx = ref.current.getContext('2d');
    const chart = new Chart(ctx, {
      plugins: [
        {
          id: 'background-white',
          // Pretty ridiculous there's no builtin way to set a background color
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
        responsive: true,
      },
      type: panel.graph.type,
      data: {
        labels: value.map((d) => d[panel.graph.x]),
        datasets: ys.map(({ field, label }, i) => {
          return {
            label,
            data: value.map((d) => +d[field]),
            backgroundColor:
              ys.length > 1 && panel.graph.type !== 'pie'
                ? colors[i]
                : panel.graph.type
                ? getNDifferentColors(value.length, ys.length, i)
                : colors,
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
  }, [ref.current, data, panel.graph.x, panel.graph.ys, panel.graph.type]);

  if (!value || !value.length) {
    return null;
  }

  return <canvas ref={ref} />;
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
      <FormGroup label="General">
        <div className="form-row">
          <Select
            label="Graph"
            value={panel.graph.type}
            onChange={(value: string) => {
              panel.graph.type = value as GraphPanelInfoType;
              updatePanel(panel);
            }}
          >
            <option value="bar">Bar</option>
            <option value="pie">Pie</option>
          </Select>
        </div>
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
