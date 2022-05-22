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

export const BUILTINS: Record<
  ProgramPanelInfo['program']['type'],
  Array<{ value: string; meta: string; score: number }>
> = {
  sql: [
    {
      value: 'cast(a AS text)',
      meta: 'Convert to type',
      score: 1000,
    },
    {
      value: 'abs(n)',
      meta: 'Absolute value',
      score: 1000,
    },
    {
      value: 'coalesce(a, b[, ...])',
      meta: 'Convert nulls',
      score: 1000,
    },
    {
      value: 'format(formatString[, ...])',
      meta: 'Format values',
      score: 1000,
    },
    {
      value: 'glob(match, string)',
      meta: 'Glob match',
      score: 1000,
    },
    {
      value: 'ifnull(test, then)',
      meta: 'Coalesce with one case',
      score: 1000,
    },
    {
      value: 'iif(test, then, else)',
      meta: '',
      score: 1000,
    },
    {
      value: 'instr(haystack, needle)',
      meta: '1-index position in string',
      score: 1000,
    },
    {
      value: 'length(s)',
      meta: 'Length of string',
      score: 1000,
    },
    {
      value: 'like(match, a)',
      meta: 'SQL LIKE match',
      score: 1000,
    },
    {
      value: 'lower(s)',
      meta: 'To lower case',
      score: 1000,
    },
    {
      value: 'ltrim(s[, characters])',
      meta: 'Remove characters on left',
      score: 1000,
    },
    {
      value: 'max(a, b[, ...])',
      meta: 'Max of n values',
      score: 1000,
    },
    {
      value: 'min(a, b[, ...])',
      meta: 'Min of n values',
      score: 1000,
    },
    {
      value: 'nullif(a, b)',
      meta: 'a if a != b, else null',
      score: 1000,
    },
    {
      value: 'printf(formatString[, ...])',
      meta: 'Format values',
      score: 1000,
    },
    {
      value: 'random()',
      meta: 'Generate pseudo-random int',
      score: 1000,
    },
    {
      value: 'replace(s, what, with)',
      meta: 'String substitution',
      score: 1000,
    },
    {
      value: 'round(n[, mDigits])',
      meta: 'Round to m digits',
      score: 1000,
    },
    {
      value: 'rtrim(s[, characters])',
      meta: 'Remove characters on right',
      score: 1000,
    },
    {
      value: 'sign(n)',
      meta: 'Sign of number',
      score: 1000,
    },
    {
      value: 'substr(s, index[, length])',
      meta: 'Substring from index',
      score: 1000,
    },
    {
      value: 'substring(s, index[, length])',
      meta: 'Substring from index',
      score: 1000,
    },
    {
      value: 'trim(s[, characters])',
      meta: 'Remove characters',
      score: 1000,
    },
    {
      value: 'upper(s)',
      meta: 'To upper case',
      score: 1000,
    },
    // Aggregates
    {
      value: 'avg(a)',
      meta: 'Average of column',
      score: 1000,
    },
    {
      value: 'count(a)',
      meta: 'Number in group',
      score: 1000,
    },
    {
      value: 'group_concat(a[, separator])',
      meta: 'Column in group concatenated',
      score: 1000,
    },
    {
      value: 'min(a)',
      meta: 'Smallest value in group',
      score: 1000,
    },
    {
      value: 'max(a)',
      meta: 'Largest value in group',
      score: 1000,
    },
    {
      value: 'sum(n)',
      meta: 'Sum of column',
      score: 1000,
    },
    {
      value: 'total(n)',
      meta: 'Sum of column',
      score: 1000,
    },
  ]
    .concat([
      // These come from go-sqlite3-stdlib
      {
        value: 'repeat(s, nTimes)',
        meta: 'String n times',
        score: 1000,
      },
      {
        value: 'replicate(s, nTimes)',
        meta: 'String n times',
        score: 1000,
      },
      {
        value: 'strpos(s, substring)',
        meta: '0-index position in string',
        score: 1000,
      },
      {
        value: 'charindex(s, substring)',
        meta: '0-index position in string',
        score: 1000,
      },
      {
        value: 'reverse(s)',
        meta: 'Reverse string',
        score: 1000,
      },
      {
        value: 'lpad(s, length[, with])',
        meta: 'Left pad',
        score: 1000,
      },
      {
        value: 'rpad(s, length[, with])',
        meta: 'Right pad',
        score: 1000,
      },
      {
        value: 'split_part(s, on, index)',
        meta: 'Split and return part at index',
        score: 1000,
      },
      {
        value: 'regexp_split_part(s, on, index)',
        meta: 'Split with regexp and return part at index',
        score: 1000,
      },
      {
        value: 'regexp_count(s, re)',
        meta: 'Count regexp matches',
        score: 1000,
      },
      {
        value: 'url_scheme(s)',
        meta: 'Scheme from URL',
        score: 1000,
      },
      {
        value: 'url_host(s)',
        meta: 'Host from URL',
        score: 1000,
      },
      {
        value: 'url_port(s)',
        meta: 'Port from URL',
        score: 1000,
      },
      {
        value: 'url_path(s)',
        meta: 'Path from URL',
        score: 1000,
      },
      {
        value: 'url_param(s, key)',
        meta: 'Param from URL',
        score: 1000,
      },
      {
        value: 'url_fragment(s)',
        meta: 'Fragment from URL',
        score: 1000,
      },
      {
        value: 'date_year(s)',
        meta: 'Best-effort year from date',
        score: 1000,
      },
      {
        value: 'date_month(s)',
        meta: 'Best-effort month from date',
        score: 1000,
      },
      {
        value: 'date_day(s)',
        meta: 'Best-effort day from date',
        score: 1000,
      },
      {
        value: 'date_yearday(s)',
        meta: 'Best-effort day in year from date',
        score: 1000,
      },
      {
        value: 'date_hour(s)',
        meta: 'Best-effort hour from date',
        score: 1000,
      },
      {
        value: 'date_minute(s)',
        meta: 'Best-effort minute from date',
        score: 1000,
      },
      {
        value: 'date_second(s)',
        meta: 'Best-effort second from date',
        score: 1000,
      },
      {
        value: 'date_unix(s)',
        meta: 'Best-effort date to UNIX timestamp',
        score: 1000,
      },
      {
        value: 'date_rfc3339(s)',
        meta: 'Best-effort date to ISO format',
        score: 1000,
      },
      {
        value: 'base64(s)',
        meta: 'Base64 encode',
        score: 1000,
      },
      {
        value: 'from_base64(s)',
        meta: 'Base64 decode',
        score: 1000,
      },
      {
        value: 'base32(s)',
        meta: 'Base32 encode',
        score: 1000,
      },
      {
        value: 'from_base32(s)',
        meta: 'Base32 decode',
        score: 1000,
      },
      {
        value: 'md5(s)',
        meta: 'Hex md5 sum',
        score: 1000,
      },
      {
        value: 'sha1(s)',
        meta: 'Hex sha1 sum',
        score: 1000,
      },
      {
        value: 'sha256(s)',
        meta: 'Hex sha1 sum',
        score: 1000,
      },
      {
        value: 'sha512(s)',
        meta: 'Hex sha512 sum',
        score: 1000,
      },
      {
        value: 'sha3_256(s)',
        meta: 'Hex sha3_256 sum',
        score: 1000,
      },
      {
        value: 'sha3_512(s)',
        meta: 'Hex sha3_512 sum',
        score: 1000,
      },
      {
        value: 'blake2b_256(s)',
        meta: 'Hex blake2b_256 sum',
        score: 1000,
      },
      {
        value: 'blake2b_512(s)',
        meta: 'Hex blake2b_512 sum',
        score: 1000,
      },
      // Aggregate
      {
        value: 'stddev(n)',
        meta: 'Standard deviation',
        score: 1000,
      },
      {
        value: 'stdev(n)',
        meta: 'Standard deviation',
        score: 1000,
      },
      {
        value: 'stddev_pop(n)',
        meta: 'Standard deviation',
        score: 1000,
      },
      {
        value: 'mode(a)',
        meta: 'Most common value',
        score: 1000,
      },
      {
        value: 'median(a)',
        meta: 'Value in the middle',
        score: 1000,
      },
      {
        value: 'percentile(a, perc0to100)',
        meta: 'Discrete percentile',
        score: 1000,
      },
      {
        value: 'perc(a, perc0to100)',
        meta: 'Discrete percentile',
        score: 1000,
      },
      {
        value: 'percentile_cont(a, perc0to100)',
        meta: 'Continuous percentile',
        score: 1000,
      },
      {
        value: 'perc_cont(a, perc0to100)',
        meta: 'Continuous percentile',
        score: 1000,
      },
      {
        value: 'perc_25(a)',
        meta: 'Discrete 25th percentile',
        score: 1000,
      },
      {
        value: 'percentile_25(a)',
        meta: 'Discrete 25th percentile',
        score: 1000,
      },
      {
        value: 'perc_cont_25(a)',
        meta: 'Continous 25th percentile',
        score: 1000,
      },
      {
        value: 'percentile_cont_25(a)',
        meta: 'Continuous 25th percentile',
        score: 1000,
      },
      {
        value: 'perc_50(a)',
        meta: 'Discrete 50th percentile',
        score: 1000,
      },
      {
        value: 'percentile_50(a)',
        meta: 'Discrete 50th percentile',
        score: 1000,
      },
      {
        value: 'perc_cont_50(a)',
        meta: 'Continous 50th percentile',
        score: 1000,
      },
      {
        value: 'percentile_cont_50(a)',
        meta: 'Continuous 50th percentile',
        score: 1000,
      },
      {
        value: 'perc_75(a)',
        meta: 'Discrete 75th percentile',
        score: 1000,
      },
      {
        value: 'percentile_75(a)',
        meta: 'Discrete 75th percentile',
        score: 1000,
      },
      {
        value: 'perc_cont_75(a)',
        meta: 'Continuous 75th percentile',
        score: 1000,
      },
      {
        value: 'percentile_cont_75(a)',
        meta: 'Continuous 75th percentile',
        score: 1000,
      },
      {
        value: 'perc_90(a)',
        meta: 'Discrete 90th percentile',
        score: 1000,
      },
      {
        value: 'percentile_90(a)',
        meta: 'Discrete 90th percentile',
        score: 1000,
      },
      {
        value: 'perc_cont_90(a)',
        meta: 'Continuous 90th percentile',
        score: 1000,
      },
      {
        value: 'percentile_cont_90(a)',
        meta: 'Continuous 90th percentile',
        score: 1000,
      },
      {
        value: 'perc_95(a)',
        meta: 'Discrete 95th percentile',
        score: 1000,
      },
      {
        value: 'percentile_95(a)',
        meta: 'Discrete 95th percentile',
        score: 1000,
      },
      {
        value: 'perc_cont_95(a)',
        meta: 'Continuous 95th percentile',
        score: 1000,
      },
      {
        value: 'percentile_cont_95(a)',
        meta: 'Continuous 95th percentile',
        score: 1000,
      },
      {
        value: 'perc_99(a)',
        meta: 'Discrete 99th percentile',
        score: 1000,
      },
      {
        value: 'percentile_99(a)',
        meta: 'Discrete 99th percentile',
        score: 1000,
      },
      {
        value: 'perc_cont_99(a)',
        meta: 'Continuous 99th percentile',
        score: 1000,
      },
      {
        value: 'percentile_cont_99(a)',
        meta: 'Continuous 99th percentile',
        score: 1000,
      },
    ])
    .sort((a, b) => (a.value < b.value ? -1 : 1)),
};

export function builtinCompletions(
  tokenIteratorFactory: () => Ace.TokenIterator,
  builtins: Array<{ value: string; meta: string; score: number }>,
  language: ProgramPanelInfo['program']['type']
) {
  const ti = tokenIteratorFactory();
  const token = ti.getCurrentToken();

  if (token.type !== 'identifier') {
    return [];
  }

  return [
    ...builtins,
    {
      value: 'DM_getPanel("panelName")',
      meta: 'Fetch results of this DataStation panel',
      score: 1000,
    },
    ...(language === 'sql'
      ? []
      : [
          {
            value: 'DM_setPanel(result)',
            meta: 'Set results of this DataStation panel',
            score: 1000,
          },
        ]),
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

export function makeAutocomplete(
  panels: Array<PanelInfo>,
  builtins: Array<{ value: string; meta: string; score: number }>,
  language: ProgramPanelInfo['program']['type']
) {
  return (tokenIteratorFactory: () => Ace.TokenIterator, prefix: string) => {
    return [
      ...builtinCompletions(tokenIteratorFactory, builtins, language),
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
      autocomplete={makeAutocomplete(
        panels.filter((p) => p.id !== panel.id),
        BUILTINS[language] || [],
        language
      )}
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
        SQL code panels have a wealth of helper functions for best-effort date
        parsing, URL parsing, math/string helpers, and statistical aggregate
        functions. Read about them{' '}
        <a
          target="_blank"
          href="https://github.com/multiprocessio/go-sqlite3-stdlib"
        >
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
