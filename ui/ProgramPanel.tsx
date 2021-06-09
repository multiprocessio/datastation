import * as React from 'react';

import { ProgramPanelInfo } from './ProjectStore';
import { Select } from './component-library/Select';

export function evalProgramPanel(
  panel: ProgramPanelInfo,
  panelResults: Array<{ value?: Array<any> }>
) {
  const program = panel.program;
  const anyWindow = window as any;

  // TODO: better deep copy
  anyWindow.DM_getPanel = (panelId: number) =>
    JSON.parse(JSON.stringify((panelResults[panelId] || {}).value));

  switch (program.type) {
    case 'javascript':
      // TODO: sandbox
      return new Promise((resolve, reject) => {
        anyWindow.DM_setPanel = resolve;
        try {
          eval(panel.content);
        } catch (e) {
          reject(e);
        }
      });
    case 'python':
      // TODO: sandbox
      return new Promise((resolve, reject) => {
        anyWindow.DM_setPanel = resolve;
        try {
          const program =
            'from browser import window\nDM_getPanel = window.DM_getPanel\nDM_setPanel = window.DM_setPanel\n' +
            panel.content;
          eval(anyWindow.__BRYTHON__.python_to_js(program));
        } catch (e) {
          reject(e);
        }
      });
  }

  throw new Error(`Unknown program type: '${program.type}'`);
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
  return (
    <React.Fragment>
      <div>
        <Select
          value={panel.program.type}
          onChange={(value: string) => {
            panel.program.type = value as 'javascript' | 'python';
            if (panel.content === '') {
              switch (panel.program.type) {
                case 'javascript':
                  if (panelIndex === 0) {
                    panel.content = 'DM_setPanel([])';
                  } else {
                    panel.content = `const previous = DM_getPanel(${
                      panelIndex - 1
                    });\nDM_setPanel(previous);`;
                  }
                  return;
                case 'python':
                  if (panelIndex === 0) {
                    panel.content = 'DM_setPanel([])';
                  } else {
                    panel.content = `previous = DM_getPanel(${
                      panelIndex - 1
                    })\nDM_setPanel(previous)`;
                  }
                  return;
              }
            }

            updatePanel(panel);
          }}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
        </Select>
      </div>
    </React.Fragment>
  );
}
