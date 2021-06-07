import * as React from 'react';

export function evalProgramPanel(
  page: any,
  panelId: string,
  panelValues: Array<{ value?: Array<any> }>
) {
  const panel = page.panels[panelId];
  const program = panel.program || { type: 'javascript' };
  // TODO: better deep copy
  window.DM_getPanel = (panelId: number) =>
    JSON.parse(JSON.stringify((panelValues[panelId] || {}).value));
  switch (program.type) {
    case 'javascript':
      // TODO: sandbox
      return new Promise((resolve, reject) => {
        window.DM_setPanel = resolve;
        try {
          eval(panel.content);
        } catch (e) {
          reject(e);
        }
      });
    case 'python':
      // TODO: sandbox
      return new Promise((resolve, reject) => {
        window.DM_setPanel = resolve;
        try {
          const program =
            'from browser import window\nDM_getPanel = window.DM_getPanel\nDM_setPanel = window.DM_setPanel\n' +
            panel.content;
          eval(__BRYTHON__.python_to_js(program));
        } catch (e) {
          reject(e);
        }
      });
  }

  throw new Error(`Unknown program type: '${program.type}'`);
}

interface ProgramPanelInfo {
  content: string;
  program: {
    type: 'javascript' | 'python';
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
  return (
    <React.Fragment>
      <div>
        <select
          value={panel.program.type}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            panel.program.type = e.target.value as 'javascript' | 'python';
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
        </select>
      </div>
    </React.Fragment>
  );
}
