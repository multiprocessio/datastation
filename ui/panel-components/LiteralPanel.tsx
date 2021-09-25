import { preview } from 'preview';
import * as React from 'react';
import { shape } from 'shape';
import { MODE, RPC } from '../../shared/constants';
import { ContentTypeInfo, LiteralPanelInfo } from '../../shared/state';
import { parseArrayBuffer } from '../../shared/text';
import { asyncRPC } from '../asyncRPC';
import { CodeEditor } from '../component-library/CodeEditor';
import { ContentTypePicker } from '../component-library/ContentTypePicker';
import {
  guardPanel,
  PanelBodyProps,
  PanelDetailsProps,
  PanelUIDetails,
} from './types';

export async function evalLiteralPanel(panel: LiteralPanelInfo) {
  const literal = panel.literal;
  const array = new TextEncoder().encode(panel.content);
  const { value, contentType } = await parseArrayBuffer(
    panel.literal.contentTypeInfo,
    'literal.' + literal.contentTypeInfo.type,
    array
  );

  if (MODE !== 'browser') {
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

export function LiteralPanelDetails({ panel, updatePanel }: PanelDetailsProps) {
  const lp = guardPanel<LiteralPanelInfo>(panel, 'literal');

  return (
    <React.Fragment>
      <div className="form-row">
        <ContentTypePicker
          disableAutoDetect
          inMemoryEval={false}
          value={lp.literal.contentTypeInfo}
          onChange={(cti: ContentTypeInfo) => {
            lp.literal.contentTypeInfo = cti;
            updatePanel(panel);
          }}
        />
      </div>
    </React.Fragment>
  );
}

export function LiteralPanelBody({
  updatePanel,
  panel,
  keyboardShortcuts,
}: PanelBodyProps) {
  const lp = guardPanel<LiteralPanelInfo>(panel, 'literal');

  return (
    <CodeEditor
      id={lp.id}
      onKeyDown={keyboardShortcuts}
      value={lp.content}
      onChange={(value: string) => {
        lp.content = value;
        updatePanel(lp);
      }}
      language={lp.literal.type}
      className="editor"
    />
  );
}

export const literalPanel: PanelUIDetails = {
  icon: 'format_quote',
  eval: evalLiteralPanel,
  id: 'literal',
  label: 'Literal',
  details: LiteralPanelDetails,
  body: LiteralPanelBody,
  alwaysOpen: false,
  previewable: true,
  factory: () => new LiteralPanelInfo(),
  info: null,
  hasStdout: false,
  killable: true,
};
