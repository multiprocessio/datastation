import * as React from 'react';
import { MODE, RPC } from '../shared/constants';
import { LANGUAGES, SupportedLanguages } from '../shared/languages';
import { PanelResult, ProgramPanelInfo } from '../shared/state';
import { asyncRPC } from './asyncRPC';
import { Select } from './component-library/Select';

export function evalProgramPanel(
  panel: ProgramPanelInfo,
  panelResults: Array<PanelResult>,
  indexIdMap: Record<number, string>,
): Promise<{ value: any; preview: string; stdout: string }> {
  const program = panel.program;

  if (MODE === 'desktop') {
    return asyncRPC<
      ProgramPanelInfo & { indexIdMap: Record<number, string> },
      null,
      { value: any; preview: string; stdout: string }
    >(RPC.EVAL_PROGRAM, null, {
      ...panel,
      indexIdMap,
    });
  }

  const language = LANGUAGES[program.type];
  if (!language || !language.inMemoryEval) {
    throw new Error(`Unknown program type: '${program.type}'`);
  }

  return language.inMemoryEval(panel.content, panelResults);
}

export function ProgramPanelDetails({
  panel,
  updatePanel,
  panelIndex,
}: {
  panel: ProgramPanelInfo;
  updatePanel: (d: ProgramPanelInfo) => void;
  panelIndex: number;
}) {
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
