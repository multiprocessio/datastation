import React from 'react';
import { CodeEditor } from '../component-library/CodeEditor';
import { PanelBodyProps } from './types';
import {ProgramPanelInfo} from '../../shared/state';

export function ProgramPanelBody({
  updatePanel,
  panel,
  keyboardShortcuts,
}: PanelBodyProps) {
  if (panel.type !== 'program') { return null; }
  const pp = panel as ProgramPanelInfo;
  const language = pp.program.type;

  return (
    <CodeEditor
      id={pp.id}
      onKeyDown={keyboardShortcuts}
      value={pp.content}
      onChange={(value: string) => {
        pp.content = value;
        updatePanel(pp);
      }}
      language={language}
      className="editor"
    />
  );
}
