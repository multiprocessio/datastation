import React from 'react';
import { shape } from 'shape';
import { DOCS_ROOT, MODE } from '../../shared/constants';
import { LANGUAGES, SupportedLanguages } from '../../shared/languages';
import { PanelInfo, PanelResult, ProgramPanelInfo } from '../../shared/state';
import { panelRPC } from '../asyncRPC';
import { CodeEditor } from '../components/CodeEditor';
import { Input } from '../components/Input';
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

  const lastRun = new Date();
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
    loading: false,
    lastRun,
    elapsed: new Date().valueOf() - lastRun.valueOf(),
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
            panel.program.type = value as SupportedLanguages | 'custom';
            if (panel.content === '' && value !== 'custom') {
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
          {/* TODO: support when tested MODE !== 'browser' && (
            <option key="custom" value="custom">
              Custom
            </option>
          ) */}
        </Select>
      </div>
      {panel.program.type === 'custom' && (
        <div className="form-row">
          <Input
            label="Custom"
            value={panel.program.customExe}
            placeholder="/myinterpreter --file {}"
            tooltip="Provide any command to run and use `{}` as a placeholder for the file name. It will be replaced with the file name containing the panel contents when you run this panel."
            onChange={(value: string) => {
              panel.program.customExe = value;
              updatePanel(panel);
            }}
          />
        </div>
      )}
    </React.Fragment>
  );
}

export function ProgramPanelBody({
  updatePanel,
  panel,
  keyboardShortcuts,
  panels,
}: PanelBodyProps<ProgramPanelInfo>) {
  const language = panel.program.type;

  return (
    <CodeEditor
      panels={panels.map((p) => ({
        name: p.name,
        id: p.id,
        shape: p.resultMeta?.shape,
      }))}
      id={'editor-' + panel.id}
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
        <a target="_blank" href={DOCS_ROOT + '/Panels/Code_Panels.html'}>
          here
        </a>
        .
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      Use builtin functions, <code>DM_setPanel($some_array_data)</code> and{' '}
      <code>DM_getPanel($panel_number_or_name)</code>, to interact with other
      panels. Read more{' '}
      <a target="_blank" href={DOCS_ROOT + '/Panels/Code_Panels.html'}>
        here
      </a>
      .
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
  factory: (pageId: string, name: string) =>
    new ProgramPanelInfo(pageId, { name }),
  hasStdout: true,
  info: ProgramInfo,
};
