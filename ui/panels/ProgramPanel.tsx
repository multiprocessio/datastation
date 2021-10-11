import React from 'react';
import { shape } from 'shape';
import { MODE } from '../../shared/constants';
import { LANGUAGES, SupportedLanguages } from '../../shared/languages';
import { PanelResult, ProgramPanelInfo } from '../../shared/state';
import { panelRPC } from '../asyncRPC';
import { CodeEditor } from '../components/CodeEditor';
import { Select } from '../components/Select';
import { PanelBodyProps, PanelDetailsProps, PanelUIDetails } from './types';

export async function evalProgramPanel(
  panel: ProgramPanelInfo,
  panelResults: Array<PanelResult>
): Promise<PanelResult> {
  const program = panel.program;

  if (MODE !== 'browser') {
    return panelRPC('eval', panel.id);
  }

  const language = LANGUAGES[program.type];
  if (!language || !language.inMemoryEval) {
    throw new Error(`Unknown program type: '${program.type}'`);
  }

  const res = await language.inMemoryEval(panel.content, panelResults);
  const s = shape(res.value);
  return {
    ...res,
    size: res.value ? JSON.stringify(res.value).length : 0,
    shape: s,
    arrayCount: s.kind === 'array' ? (res.value || []).length : null,
    contentType: 'application/json',
  };
}

export function ProgramPanelDetails({
  panel,
  updatePanel,
  panelIndex,
}: PanelDetailsProps<ProgramPanelInfo>) {
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
          value={panel.program.type}
          onChange={(value: string) => {
            panel.program.type = value as SupportedLanguages;
            if (panel.content === '') {
              panel.content =
                LANGUAGES[panel.program.type].defaultContent(panelIndex);
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
}: PanelBodyProps<ProgramPanelInfo>) {
  const language = panel.program.type;

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

export function ProgramInfo({ panel }: { panel: ProgramPanelInfo }) {
  if (panel.program.type === 'sql') {
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
      {panel.program.type === 'julia' && (
        <React.Fragment>
          <br />
          <br />
          Install <a href="https://github.com/JuliaIO/JSON.jl">JSON.jl</a> to
          script with Julia.
        </React.Fragment>
      )}
      {panel.program.type === 'r' && (
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

export const programPanel: PanelUIDetails<ProgramPanelInfo> = {
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
};
