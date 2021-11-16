import React from 'react';
import { shape } from 'shape';
import { MODE, SITE_ROOT } from '../../shared/constants';
import { LANGUAGES, SupportedLanguages } from '../../shared/languages';
import { PanelInfo, PanelResult, ProgramPanelInfo } from '../../shared/state';
import { panelRPC } from '../asyncRPC';
import { CodeEditor } from '../components/CodeEditor';
import { Select } from '../components/Select';
import { PanelBodyProps, PanelDetailsProps, PanelUIDetails } from './types';

export async function evalProgramPanel(
  panel: ProgramPanelInfo,
  panels: Array<PanelInfo>
): Promise<PanelResult> {
  const program = panel.program;

  if (MODE !== 'browser') {
    return panelRPC('eval', panel.id);
  }

  const language = LANGUAGES[program.type];
  if (!language || !language.inMemoryEval) {
    throw new Error(`Unknown program type: '${program.type}'`);
  }

  const panelResults: Record<string | number, PanelResult> = {};
  panels.forEach((p, index) => {
    panelResults[index] = p.resultMeta;
    panelResults[p.name] = p.resultMeta;
  });

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
        Use <code>DM_getPanel($panel_number_or_name)</code> to reference other
        panels. Once you have called this once for one panel, use{' '}
        <code>t_$panel_number_or_name</code> to refer to it again. Read more{' '}
        <a href={SITE_ROOT + '/docs/Panels/Code_Panels.html'}>here</a>.
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      Use builtin functions, <code>DM_setPanel($some_array_data)</code> and{' '}
      <code>DM_getPanel($panel_number_or_name)</code>, to interact with other
      panels. Read more{' '}
      <a href={SITE_ROOT + '/docs/Panels/Code_Panels.html'}>here</a>.
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
  previewable: true,
  factory: () => new ProgramPanelInfo(),
  hasStdout: true,
  info: ProgramInfo,
};
