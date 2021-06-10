import * as React from 'react';

import { LiteralPanelInfo } from '../shared/state';
import { parseCSV } from '../shared/text';
import { Select } from './component-library/Select';

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
        <Select
          label="Format"
          value={panel.literal.type}
          onChange={(value: string) => {
            switch (value) {
              case 'json':
                panel.literal.type = 'json';
                break;
              case 'csv':
                panel.literal.type = 'csv';
                break;
              default:
                throw new Error(`Unknown literal type: ${value}`);
            }
            updatePanel(panel);
            updatePanel(panel);
          }}
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </Select>
      </div>
    </React.Fragment>
  );
}
