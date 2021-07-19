import * as React from 'react';
import circularSafeStringify from 'json-stringify-safe';

import { MODE, MODE_FEATURES } from '../shared/constants';
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
  const anyWindow = window as any;

  if (MODE === 'desktop') {
    return asyncRPC<ProgramPanelInfo, null, [Array<object>, string]>(
      'evalProgram',
      null,
      panel
    );
  }

  // TODO: better deep copy
  anyWindow.DM_getPanel = (panelId: number) =>
    JSON.parse(JSON.stringify((panelResults[panelId] || {}).value));

  const stdout: Array<string> = [];
  const print = (...n: Array<any>) =>
    stdout.push(n.map((v) => circularSafeStringify(v)).join(' '));

  switch (program.type) {
    case 'javascript':
      // TODO: sandbox
      return new Promise((resolve, reject) => {
        anyWindow.DM_setPanel = (v: any) => {
          resolve([v, stdout.join('\n')]);
        };
        const oldConsoleLog = console.log;
        console.log = print;
        try {
          eval(panel.content);
        } catch (e) {
          reject(e);
        } finally {
          console.log = oldConsoleLog;
        }
      });
    case 'python':
      // TODO: sandbox
      return new Promise((resolve, reject) => {
        anyWindow.DM_setPanel = (v: any) => {
          resolve([v, stdout.join('\n')]);
        };
        const oldConsoleLog = console.log;
        console.log = print;
        try {
          const program =
            'import js as window\nprint = lambda *args: window.console.log(*args)\nDM_getPanel = window.DM_getPanel\nDM_setPanel = window.DM_setPanel\n' +
            panel.content;
          (window as any).pyodide.runPython(program);
        } catch (e) {
          reject(e);
        } finally {
          console.log = oldConsoleLog;
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
  const options = [
    { value: 'javascript', name: 'JavaScript' },
    { value: 'python', name: 'Python' },
    ...(MODE_FEATURES.extraLanguages
      ? [
          { value: 'ruby', name: 'Ruby' },
          { value: 'r', name: 'R' },
          { value: 'julia', name: 'Julia' },
        ]
      : []),
  ];
  return (
    <React.Fragment>
      <div className="form-row">
        <Select
          label="Language"
          value={panel.program.type}
          onChange={(value: string) => {
            panel.program.type = value as ProgramPanelInfoType;
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
