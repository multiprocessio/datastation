import * as React from 'react';
import Chart from 'chart.js/auto';

interface GraphY {
  field: string;
  label: string;
}

interface GraphPanelInfo {
  content: string;
  graph: {
    panelSource: number;
    y: GraphY;
    x: string;
    type: 'bar';
  };
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
    if (!ref) {
      return;
    }

    const ctx = ref.current.getContext('2d');
    const chart = new Chart(ctx, {
      type,
      data: {
        labels: value.map((d) => d[x]),
        datasets: [
          {
            label: y.label,
            data: value.map((d) => d[y.field]),
          },
        ],
      },
    });

    return () => chart.destroy();
  }, [ref.current, data, x, y, type]);
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
