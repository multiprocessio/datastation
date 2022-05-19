import { Ace } from 'ace-builds';
import React from 'react';
import { shape, toString as shapeToString } from 'shape';
import { DOCS_ROOT, MODE } from '../../shared/constants';
import { LANGUAGES, SupportedLanguages } from '../../shared/languages';
import { PanelInfo, PanelResult, ProgramPanelInfo } from '../../shared/state';
import { panelRPC } from '../asyncRPC';
import { CodeEditor } from '../components/CodeEditor';
import { allFields } from '../components/FieldPicker';
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
    .sort()
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

export function builtinCompletions(
  tokenIteratorFactory: () => Ace.TokenIterator
) {
  const ti = tokenIteratorFactory();
  const token = ti.getCurrentToken();

  if (token.type !== 'identifier') {
    return [];
  }

  return [
    {
      value: 'DM_getPanel("indexOrName")',
      meta: 'Builtin',
      score: 1000,
    },
    {
      value: 'DM_setPanel(result)',
      meta: 'Builtin',
      score: 1000,
    },
  ];
}

export function panelNameCompletions(
  tokenIteratorFactory: () => Ace.TokenIterator,
  panels: Array<PanelInfo>
) {
  const ti = tokenIteratorFactory();
  const token = ti.getCurrentToken();
  ti.stepBackward();
  const maybeLParen = ti.getCurrentToken();
  ti.stepBackward();
  const maybeDmCall = ti.getCurrentToken();

  if (
    maybeDmCall.value === 'DM_getPanel' &&
    maybeLParen.value === '(' &&
    token.type === 'string'
  ) {
    return panels.map(
      (panel) =>
        ({
          value: panel.name,
          meta: 'Panel',
          score: 1000,
        } as Ace.Completion)
    );
  }

  return [];
}

export function dotAccessPanelShapeCompletions(
  tokenIteratorFactory: () => Ace.TokenIterator,
  panels: Array<PanelInfo>
) {
  const ti = tokenIteratorFactory();

  // Look for x.a(cursor) pattern
  if (!ti.stepBackward()) return [];
  if (ti.getCurrentToken().value !== '.') return [];

  if (!ti.stepBackward()) return [];
  if (ti.getCurrentToken().type !== 'identifier') return [];

  return (panels || []).map(function panelShapeToFields(panel) {
    const shape = panel?.resultMeta?.shape;
    if (!shape) {
      return [];
    }

    return (allFields(shape) || [])
      .map(([path, shape]) => ({
        name: panel.name + ': ' + shapeToString(shape).replace('\n', ' '),
        value: path,
        score: 1000,
        meta: 'Field',
      }))
      .filter((c) => !c.value.includes('.'));
  });
}

export function stringPanelShapeCompletions(
  tokenIteratorFactory: () => Ace.TokenIterator,
  panels: Array<PanelInfo>
) {
  // No shapes necessary in a DM_getPanel call
  if (panelNameCompletions(tokenIteratorFactory, panels).length) {
    return [];
  }

  const ti = tokenIteratorFactory();
  const token = ti.getCurrentToken();
  if (token.type !== 'string') {
    return [];
  }

  return (panels || []).map(function panelShapeToFields(panel) {
    const shape = panel?.resultMeta?.shape;
    if (!shape) {
      return [];
    }

    return (allFields(shape) || [])
      .map(([path, shape]) => ({
        name: panel.name + ': ' + shapeToString(shape).replace('\n', ' '),
        value: path,
        score: 1000,
        meta: 'Field',
      }))
      .filter((c) => c && !c.value.includes('\\\\'));
  });
}

export function makeAutocomplete(panels: Array<PanelInfo>) {
  return (tokenIteratorFactory: () => Ace.TokenIterator, prefix: string) => {
    return [
      ...builtinCompletions(tokenIteratorFactory),
      ...panelNameCompletions(tokenIteratorFactory, panels),
      ...dotAccessPanelShapeCompletions(tokenIteratorFactory, panels),
      ...stringPanelShapeCompletions(tokenIteratorFactory, panels),
    ]
      .flat()
      .filter((c) => c && c.value.startsWith(prefix));
  };
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
      autocomplete={makeAutocomplete(panels.filter((p) => p.id !== panel.id))}
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
        panels. Read more{' '}
        <a target="_blank" href={DOCS_ROOT + '/Panels/Code_Panels.html'}>
          here
        </a>
        .
        <br />
        <br />
        SQL code panels have a wealth of helper functions for best-effort date parsing, URL parsing, math/string helpers, and statistical aggregate functions. Read about them <a target="_blank" href="https://github.com/multiprocessio/go-sqlite3-stdlib">here</a>.
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
