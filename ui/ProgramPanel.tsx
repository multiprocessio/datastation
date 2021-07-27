import * as React from 'react';
import { MODE, RPC } from '../shared/constants';
import { LANGUAGES, SupportedLanguages } from '../shared/languages';
import { shape } from '../shared/shape';
import { PanelResult, ProgramPanelInfo } from '../shared/state';
import { asyncRPC } from './asyncRPC';
import { Select } from './component-library/Select';

export async function evalProgramPanel(
  panel: ProgramPanelInfo,
  panelResults: Array<PanelResult>,
  indexIdMap: Array<string>
): Promise<PanelResult> {
  const program = panel.program;

  if (MODE === 'desktop') {
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
    shape: shape(res.value),
  };
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
