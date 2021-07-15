import * as React from 'react';
import Chart from 'chart.js/auto';

import {
  PanelInfo,
  GraphPanelInfo,
  GraphPanelInfoType,
  PanelResult,
} from '../shared/state';

import { previewObject } from './preview';
import { PanelSourcePicker } from './PanelSourcePicker';
import { FieldPicker } from './FieldPicker';
import { Select } from './component-library/Select';

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
function getNDifferentColors(n: number) {
  const colors = [];
  while (n >= 0) {
    colors.push(COLORS[n % COLORS.length]);
    n--;
  }
  return colors;
}

export function GraphPanel({
  panel,
  data,
}: {
  panel: GraphPanelInfo;
  data?: { value?: Array<any> };
}) {
  const value = (data || {}).value || [];
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref || !value.length) {
      return;
    }

    if (!Array.isArray(value)) {
      console.error(
        `Expected array input to graph, got (${typeof value}): ` +
          previewObject(value)
      );
      return;
    }

    const ctx = ref.current.getContext('2d');
    const chart = new Chart(ctx, {
      plugins: [
        {
          id: 'background-white',
          // Pretty ridiculous there's no builtin way to set a background color
          // https://stackoverflow.com/a/38493678/1507139
          beforeDraw: function () {
            const chartArea = chart.chartArea;

            ctx.save();
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, ref.current.width, ref.current.height);
            ctx.restore();
          },
        },
      ],
      type: panel.graph.type,
      data: {
        labels: value.map((d) => d[panel.graph.x]),
        datasets: [
          {
            label: panel.graph.y.label,
            data: value.map((d) => +d[panel.graph.y.field]),
            backgroundColor: getNDifferentColors(value.length),
          },
        ],
      },
    });

    return () => chart.destroy();
  }, [ref.current, data, panel.graph.x, panel.graph.y, panel.graph.type]);

  if (!value.length) {
    return null;
  }

  return <canvas ref={ref} />;
}

export function GraphPanelDetails({
  panel,
  panels,
  updatePanel,
  data,
}: {
  panel: GraphPanelInfo;
  panels: Array<PanelInfo>;
  updatePanel: (d: GraphPanelInfo) => void;
  data: PanelResult;
}) {
  return (
    <React.Fragment>
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
          onChange={(value: number) => {
            panel.graph.panelSource = value;
            updatePanel(panel);
          }}
        />
      </div>
      <div className="form-row">
        <FieldPicker
          label={panel.graph.type === 'pie' ? 'Slice Field' : 'X-Axis Field'}
          panelSourceResult={data}
          value={panel.graph.x}
          onChange={(value: string) => {
            panel.graph.x = value;
            updatePanel(panel);
          }}
        />
      </div>
      <div className="form-row">
        <label>{panel.graph.type === 'pie' ? 'Slice Size' : 'Y-Axis'}</label>
        <div className="form-row">
          <FieldPicker
            label="Field"
            panelSourceResult={data}
            value={panel.graph.y.field}
            onChange={(value: string) => {
              panel.graph.y.field = value;
              updatePanel(panel);
            }}
            labelValue={panel.graph.y.label}
            labelOnChange={(value: string) => {
              panel.graph.y.label = value;
              updatePanel(panel);
            }}
          />
        </div>
      </div>
    </React.Fragment>
  );
}
