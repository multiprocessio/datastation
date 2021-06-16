import * as React from 'react';
import Chart from 'chart.js/auto';

import { PanelInfo, GraphPanelInfo } from '../shared/state';

import { PanelSourcePicker } from './PanelSourcePicker';
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
  panels,
  updatePanel,
}: {
  panel: GraphPanelInfo;
  panels: Array<PanelInfo>;
  updatePanel: (d: GraphPanelInfo) => void;
}) {
  return (
    <React.Fragment>
      <div className="form-row">
        <PanelSourcePicker
          panels={panels}
          value={panel.graph.panelSource}
          onChange={(value: number) => {
            panel.graph.panelSource = value;
            updatePanel(panel);
          }}
        />
      </div>
      <div className="form-row">
        <Input
          label="X-Axis Field"
          value={panel.graph.x}
          onChange={(value: string) => {
            panel.graph.x = value;
            updatePanel(panel);
          }}
        />
      </div>
      <div className="form-row">
        <label>Y-Axis Field and Label</label>
        <div className="form-row">
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
