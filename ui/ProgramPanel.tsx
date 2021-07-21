import * as React from 'react';

import { MODE } from '../shared/constants';
import { LANGUAGES } from '../shared/languages';
import {
  PanelResult,
  ProgramPanelInfo,
  ProgramPanelInfoType,
} from '../shared/state';

import { asyncRPC } from './asyncRPC';
import { Select } from './component-library/Select';

export function evalProgramPanel(
  panel: ProgramPanelInfo,
  panelResults: Array<PanelResult>
): Promise<[any, string]> {
  const program = panel.program;

  if (MODE === 'desktop') {
    return asyncRPC<ProgramPanelInfo, null, [Array<object>, string]>(
      'evalProgram',
      null,
      panel
    );
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
            panel.program.type = value as ProgramPanelInfoType;
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
