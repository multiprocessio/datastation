import * as React from 'react';
import Chart from 'chart.js/auto';

import { GraphPanelInfo } from './ProjectStore';
import { Input } from './component-library/Input';

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
        <Input
          label="Panel Source"
          type="number"
          min={0}
          max={panelCount - 1}
          value={panel.graph.panelSource.toString()}
          onChange={(value: string) => {
            panel.graph.panelSource = +value;
            updatePanel(panel);
          }}
        />
      </div>
      <div>
        <Input
          label="X-Axis Field"
          value={panel.graph.x}
          onChange={(value: string) => {
            panel.graph.x = value;
            updatePanel(panel);
          }}
        />
      </div>
      <div>
        <label>Y-Axis Field and Label</label>
        <div>
          <Input
            label="Field"
            value={panel.graph.y.field}
            onChange={(value: string) => {
              panel.graph.y.field = value;
              updatePanel(panel);
            }}
          />
          <Input
            label="Label"
            value={panel.graph.y.label}
            onChange={(value: string) => {
              panel.graph.y.label = value;
              updatePanel(panel);
            }}
          />
        </div>
      </div>
    </React.Fragment>
  );
}
