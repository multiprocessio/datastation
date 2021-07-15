import * as React from 'react';

import { LiteralPanelInfo } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';
import { Select } from './component-library/Select';

export async function evalLiteralPanel(panel: LiteralPanelInfo) {
  const literal = panel.literal;
  const array = new TextEncoder().encode(panel.content);
  return await parseArrayBuffer('', 'literal.' + literal.type, array);
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
      <div className="form-row">
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
          }}
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </Select>
      </div>
    </React.Fragment>
  );
}
