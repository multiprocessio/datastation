import * as React from 'react';

import { parseCSV } from './HTTPPanel';

export function evalLiteralPanel(page, panelId) {
  const panel = page.panels[panelId];
  const literal = panel.literal;
  switch (literal.type) {
    case 'csv':
      return parseCSV(panel.content);
    case 'json':
      return JSON.parse(panel.content);
  }

  throw new Error(`Unknown literal type: '${literal.type}'`);
}

interface LiteralPanelInfo {
  content: string;
  literal: {
    type: 'csv' | 'json';
  };
}

export function LiteralPanelDetails({
  panel,
  updatePanel,
}: {
  panel: LiteralPanelInfo;
  updatePanel: (d: LiteralPanelInfo) => void;
}) {
  return (
    <React.Fragment>
      <div>
        <select
          value={panel.literal.type}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            panel.literal.type = e.target.value;
            updatePanel(panel);
          }}
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
      </div>
    </React.Fragment>
  );
}
