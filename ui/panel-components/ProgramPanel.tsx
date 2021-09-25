import React from 'react';
import { shape } from 'shape';
import { CodeEditor } from '../component-library/CodeEditor';
import { MODE, RPC } from '../../shared/constants';
import { LANGUAGES, SupportedLanguages } from '../../shared/languages';
import { PanelResult, ProgramPanelInfo } from '../../shared/state';
import { asyncRPC } from '../asyncRPC';
import { Select } from '../component-library/Select';
import {PanelUIDetails, PanelBodyProps, PanelDetailsProps } from './types';

export async function evalProgramPanel(
  panel: ProgramPanelInfo,
  panelResults: Array<PanelResult>,
  indexIdMap: Array<string>
): Promise<PanelResult> {
  const program = panel.program;

  if (MODE !== 'browser') {
    return asyncRPC<
      ProgramPanelInfo & { indexIdMap: Array<string> },
      null,
      PanelResult
    >(RPC.EVAL_PROGRAM, null, {
      ...panel,
      indexIdMap,
    });
  }

  const language = LANGUAGES[program.type];
  if (!language || !language.inMemoryEval) {
    throw new Error(`Unknown program type: '${program.type}'`);
  }

  const res = await language.inMemoryEval(panel.content, panelResults);
  return {
    ...res,
    size: res.value ? JSON.stringify(res.value).length : 0,
    contentType: 'application/json',
    shape: shape(res.value),
  };
}

export function ProgramPanelDetails({
  panel,
  updatePanel,
  panelIndex,
}: PanelDetailsProps) {
  if (panel.type !== 'program') { return null; }
  const pp = panel as ProgramPanelInfo;

  const options = Object.keys(LANGUAGES)
    .map((k) => {
      const l = LANGUAGES[k];
      if (MODE === 'browser' && !l.inMemoryEval) {
        return null;
      }

      return { value: k, name: l.name };
    })
    .filter(Boolean);

  return (
    <React.Fragment>
      <div className="form-row">
        <Select
          label="Language"
          value={pp.program.type}
          onChange={(value: string) => {
            pp.program.type = value as SupportedLanguages;
            if (pp.content === '') {
              pp.content =
                LANGUAGES[pp.program.type].defaultContent(panelIndex);
            }

            updatePanel(panel);
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.name}
            </option>
          ))}
        </Select>
      </div>
    </React.Fragment>
  );
}

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

export const programPanel: PanelUIDetails = {
  icon: 'code',
  eval: evalProgramPanel,
  id: 'program',
  label: 'Code',
  details: ProgramPanelDetails,
  body: ProgramPanelBody,
  alwaysOpen: false,
  previewable: true,
  factory: () => new ProgramPanelInfo,
};

