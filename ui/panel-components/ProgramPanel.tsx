import React from 'react';
import { shape } from 'shape';
import { MODE } from '../../shared/constants';
import { LANGUAGES, SupportedLanguages } from '../../shared/languages';
import { ENDPOINTS } from '../../shared/rpc';
import { PanelInfo, PanelResult, ProgramPanelInfo } from '../../shared/state';
import { asyncRPC } from '../asyncRPC';
import { CodeEditor } from '../component-library/CodeEditor';
import { Select } from '../component-library/Select';
import {
  guardPanel,
  PanelBodyProps,
  PanelDetailsProps,
  PanelUIDetails,
} from './types';

export async function evalProgramPanel(
  panel: PanelInfo,
  panelResults: Array<PanelResult>,
  indexIdMap: Array<string>
): Promise<PanelResult> {
  const pp = guardPanel<ProgramPanelInfo>(panel, 'program');
  const program = pp.program;

  if (MODE !== 'browser') {
    return asyncRPC<
      ProgramPanelInfo & { indexIdMap: Array<string> },
      null,
      PanelResult
    >(ENDPOINTS.EVAL_PROGRAM, null, {
      ...panel,
      indexIdMap,
    });
  }

  const language = LANGUAGES[program.type];
  if (!language || !language.inMemoryEval) {
    throw new Error(`Unknown program type: '${program.type}'`);
  }

  const res = await language.inMemoryEval(pp.content, panelResults);
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
  if (panel.type !== 'program') {
    return null;
  }
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
  const pp = guardPanel<ProgramPanelInfo>(panel, 'program');
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

export function ProgramInfo({ panel }: { panel: PanelInfo }) {
  const pp = guardPanel<ProgramPanelInfo>(panel, 'program');
  if (pp.program.type === 'sql') {
    return (
      <React.Fragment>
        Use <code>DM_getPanel($panel_number)</code> to reference other panels.
        Once you have called this once for one panel, use{' '}
        <code>t$panel_number</code> to refer to it again. For example:{' '}
        <code>SELECT age, name FROM DM_getPanel(0) WHERE t0.age &gt; 1;</code>
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      Use builtin functions, <code>DM_setPanel($some_array_data)</code> and{' '}
      <code>DM_getPanel($panel_number)</code>, to interact with other panels.
      For example:{' '}
      <code>const passthrough = DM_getPanel(0); DM_setPanel(passthrough);</code>
      {pp.program.type === 'julia' && (
        <React.Fragment>
          <br />
          <br />
          Install <a href="https://github.com/JuliaIO/JSON.jl">JSON.jl</a> to
          script with Julia.
        </React.Fragment>
      )}
      {pp.program.type === 'r' && (
        <React.Fragment>
          <br />
          <br />
          Install <a href="https://rdrr.io/cran/rjson/">rjson</a> to script with
          R.
        </React.Fragment>
      )}
    </React.Fragment>
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
  factory: () => new ProgramPanelInfo(),
  hasStdout: true,
  info: ProgramInfo,
  killable: true,
};
