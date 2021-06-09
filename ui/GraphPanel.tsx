import * as React from 'react';
import Chart from 'chart.js/auto';

import { GraphPanelInfo } from './ProjectStore';

export function GraphPanel({
  panel,
  data,
}: {
  panel: GraphPanelInfo;
  data?: { value?: Array<any> };
}) {
    const value = (data || {}).value || [];
    console.log(value.map((d) => d[panel.graph.y.field]));
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref) {
      return;
    }

    const ctx = ref.current.getContext('2d');
    const chart = new Chart(ctx, {
      type: panel.graph.type,
      data: {
        labels: value.map((d) => d[panel.graph.x]),
        datasets: [
          {
            label: panel.graph.y.label,
            data: value.map((d) => d[panel.graph.y.field]),
          },
        ],
      },
    });

    return () => chart.destroy();
  }, [ref.current, data, panel.graph.x, panel.graph.y, panel.graph.type]);
  return <canvas ref={ref} />;
}

export function GraphPanelDetails({
  panel,
  panelCount,
  updatePanel,
}: {
  panel: GraphPanelInfo;
  panelCount: number;
  updatePanel: (d: GraphPanelInfo) => void;
}) {
  return (
    <React.Fragment>
      <div>
        <span>Panel Source:</span>
        <input
          type="number"
          min={0}
          max={panelCount - 1}
          value={panel.graph.panelSource}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            panel.graph.panelSource = +e.target.value;
            updatePanel(panel);
          }}
        />
      </div>
      <div>
        <span>X-Axis Field:</span>
        <input
          value={panel.graph.x}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            panel.graph.x = e.target.value;
            updatePanel(panel);
          }}
        />
      </div>
      <div>
        <span>Y-Axis Field and Label</span>
        <div>
          Field:
          <input
            value={panel.graph.y.field}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              panel.graph.y.field = e.target.value;
              updatePanel(panel);
            }}
          />
          Label:
          <input
            value={panel.graph.y.label}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              panel.graph.y.label = e.target.value;
              updatePanel(panel);
            }}
          />
        </div>
      </div>
    </React.Fragment>
  );
}
