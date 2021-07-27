import { preview } from 'preview';
import * as React from 'react';
import { MODE, RPC } from '../shared/constants';
import { shape } from '../shared/shape';
import { ContentTypeInfo, LiteralPanelInfo } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';
import { asyncRPC } from './asyncRPC';
import { ContentTypePicker } from './ContentTypePicker';

export async function evalLiteralPanel(panel: LiteralPanelInfo) {
  const literal = panel.literal;
  const array = new TextEncoder().encode(panel.content);
  const { value, contentType } = await parseArrayBuffer(
    panel.literal.contentTypeInfo,
    'literal.' + literal.contentTypeInfo.type,
    array
  );

  if (MODE === 'desktop') {
    await asyncRPC<{ id: string; value: any }, void, void>(
      RPC.STORE_LITERAL,
      null,
      {
        id: panel.id,
        value,
      }
    );
  }

  return {
    value,
    preview: preview(value),
    shape: shape(value),
    stdout: '',
    contentType,
    size: panel.content.length,
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
