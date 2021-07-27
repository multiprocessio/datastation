import { preview } from 'preview';
import * as React from 'react';
import { shape } from '../shared/shape';
import { ContentTypeInfo, LiteralPanelInfo } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';
import { ContentTypePicker } from './ContentTypePicker';

export async function evalLiteralPanel(panel: LiteralPanelInfo) {
  const literal = panel.literal;
  const array = new TextEncoder().encode(panel.content);
  const value = await parseArrayBuffer(
    panel.literal.contentTypeInfo,
    'literal.' + literal.contentTypeInfo.type,
    array
  );

  return { value, preview: preview(value), shape: shape(value), stdout: '' };
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
        <ContentTypePicker
          disableAutoDetect
          inMemoryEval={false}
          value={panel.literal.contentTypeInfo}
          onChange={(cti: ContentTypeInfo) => {
            panel.literal.contentTypeInfo = cti;
            updatePanel(panel);
          }}
        />
      </div>
    </React.Fragment>
  );
}
