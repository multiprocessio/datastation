import { MODE } from '@datastation/shared/constants';
import { ContentTypeInfo, LiteralPanelInfo } from '@datastation/shared/state';
import { parseArrayBuffer } from '@datastation/shared/text';
import { preview } from '@multiprocess/preview';
import { shape } from '@multiprocess/shape';
import * as React from 'react';
import { panelRPC } from '../asyncRPC';
import { CodeEditor } from '../components/CodeEditor';
import { ContentTypePicker } from '../components/ContentTypePicker';
import { PanelBodyProps, PanelDetailsProps, PanelUIDetails } from './types';

export async function evalLiteralPanel(panel: LiteralPanelInfo) {
  const literal = panel.literal;
  const array = new TextEncoder().encode(panel.content);
  const { value, contentType } = await parseArrayBuffer(
    panel.literal.contentTypeInfo,
    'literal.' + literal.contentTypeInfo.type,
    array
  );

  if (MODE !== 'browser') {
    await panelRPC('eval', panel.id);
  }

  const s = shape(value);
  return {
    value,
    preview: preview(value),
    shape: s,
    stdout: '',
    contentType,
    arrayCount: s.kind === 'array' ? (value || []).length : null,
    size: panel.content.length,
  };
}

export function LiteralPanelDetails({
  panel,
  updatePanel,
}: PanelDetailsProps<LiteralPanelInfo>) {
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

export function LiteralPanelBody({
  updatePanel,
  panel,
  keyboardShortcuts,
}: PanelBodyProps<LiteralPanelInfo>) {
  const { type } = panel.literal.contentTypeInfo;
  let language = type.split('/').pop();
  if (!['json', 'csv'].includes(language)) {
    // dunno
    language = 'javascript';
  }

  return (
    <CodeEditor
      id={panel.id}
      onKeyDown={keyboardShortcuts}
      value={panel.content}
      onChange={(value: string) => {
        panel.content = value;
        updatePanel(panel);
      }}
      language={language}
      className="editor"
    />
  );
}

export const literalPanel: PanelUIDetails<LiteralPanelInfo> = {
  icon: 'format_quote',
  eval: evalLiteralPanel,
  id: 'literal',
  label: 'Literal',
  details: LiteralPanelDetails,
  body: LiteralPanelBody,
  previewable: true,
  factory: () => new LiteralPanelInfo(),
  info: null,
  hasStdout: false,
};
