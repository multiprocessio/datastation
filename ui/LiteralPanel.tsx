import * as React from 'react';

import { LiteralPanelInfo, ProjectPage } from './ProjectStore';
import { parseCSV } from './HTTPPanel';

export function evalLiteralPanel(panel: LiteralPanelInfo) {
  const literal = panel.literal;
  switch (literal.type) {
    case 'csv':
      return parseCSV(panel.content);
    case 'json':
      return JSON.parse(panel.content);
  }

  throw new Error(`Unknown literal type: '${literal.type}'`);
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
            switch (e.target.value) {
              case 'json':
                panel.literal.type = 'json';
                break;
              case 'csv':
                panel.literal.type = 'csv';
                break;
              default:
                throw new Error(`Unknown literal type: ${e.target.value}`);
            }
            updatePanel(panel);
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
