import circularSafeStringify from 'json-stringify-safe';

import { PanelResult } from './state';

const EOL = /\r?\n/;
const anyWindow = window as any;

export interface LanguageInfo {
  name: string;
  defaultContent: (panelIndex: number) => string;
  preamble: (outFile: string, resultsFile: string) => string;
  defaultPath: string;
  exceptionRewriter: (msg: string, programPath: string) => string;
  inMemoryEval?: (
    prog: string,
    results: Array<PanelResult>
  ) => Promise<[any, string]>;
}

export const LANGUAGES: Record<string, LanguageInfo> = {
  javascript: {
    name: 'JavaScript',
    defaultContent: (panelIndex: number) => {
      if (panelIndex === 0) {
        return 'DM_setPanel([])';
      }

      return `const previous = DM_getPanel(${
        panelIndex - 1
      });\nDM_setPanel(previous);`;
    },
    defaultPath: 'node',
    preamble: (outFile: string, resultsFile: string) => `
function DM_getPanel(i) {
  const fs = require('fs');
  return JSON.parse(fs.readFileSync('${resultsFile}'))[i];
}
function DM_setPanel(v) {
  const fs = require('fs');
  fs.writeFileSync('${outFile}', JSON.stringify(v));
}`,
    inMemoryEval: (prog: string, results: Array<PanelResult>) => {
      // TODO: better deep copy
      anyWindow.DM_getPanel = (panelId: number) =>
        JSON.parse(JSON.stringify((results[panelId] || {}).value));

      const stdout: Array<string> = [];

      // TODO: sandbox
      return new Promise((resolve, reject) => {
        anyWindow.DM_setPanel = (v: any) => {
          resolve([v, stdout.join('\n')]);
        };
        const oldConsoleLog = console.log;
        console.log = (...n: Array<any>) =>
          stdout.push(n.map((v) => circularSafeStringify(v)).join(' '));
        try {
          eval(prog);
        } catch (e) {
          reject(e);
        } finally {
          console.log = oldConsoleLog;
        }
      });
    },
    exceptionRewriter(msg: string, programPath: string) {
      const matcher = RegExp(
        `${programPath}:([1-9]*)`.replaceAll('/', '\\/'),
        'g'
      );

      return msg.replace(matcher, function (_: string, line: string) {
        return `${programPath}:${+line - LANGUAGES.javascript.preamble('', '').split(EOL).length}`;
      });
    },
  },

  python: {
    name: 'Python',
    defaultContent: (panelIndex: number) => {
      if (panelIndex === 0) {
        return 'DM_setPanel([])';
      }

      return `previous = DM_getPanel(${
        panelIndex - 1
      });\nDM_setPanel(previous);`;
    },
    defaultPath: 'python3',
    preamble: (outFile: string, resultsFile: string) => `
def DM_getPanel(i):
  import json
  with open(r'${resultsFile}') as f:
    return json.load(f)[i]
def DM_setPanel(v):
  import json
  with open(r'${outFile}', 'w') as f:
    json.dump(v, f)`,
    inMemoryEval: (prog: string, results: Array<PanelResult>) => {
      // TODO: better deep copy
      anyWindow.DM_getPanel = (panelId: number) =>
        JSON.parse(JSON.stringify((results[panelId] || {}).value));

      const stdout: Array<string> = [];
      return new Promise((resolve, reject) => {
        anyWindow.DM_setPanel = (v: any) => {
          resolve([v.toJs(), stdout.join('\n')]);
        };
        const oldConsoleLog = console.log;
        console.log = (...n: Array<any>) =>
          stdout.push(n.map((v) => circularSafeStringify(v.toJs())).join(' '));
        try {
          const fullProgram =
            'import js as window\nprint = lambda *args: window.console.log(*args)\nDM_getPanel = window.DM_getPanel\nDM_setPanel = window.DM_setPanel\n' +
            prog;
          anyWindow.pyodide.runPython(fullProgram);
        } catch (e) {
          reject(e);
        } finally {
          console.log = oldConsoleLog;
        }
      });
    },
    exceptionRewriter(msg: string, _: string) {
      const matcher = /, line ([1-9]*), in <module>/g;

      return msg.replace(matcher, function (_: string, line: string) {
        return `, line ${
          +line - LANGUAGES.python.preamble('', '').split(EOL).length
        }, in <module>`;
      });
    },
  },

  ruby: {
    name: 'Ruby',
    defaultPath: 'ruby',
    defaultContent: (panelIndex: number) => {
      if (panelIndex === 0) {
        return 'DM_setPanel([])';
      }

      return `previous = DM_getPanel(${
        panelIndex - 1
      });\nDM_setPanel(previous);`;
    },
    preamble: (outFile: string, resultsFile: string) => `
def DM_getPanel(i)
  require 'json'
  JSON.parse(File.read('${resultsFile}'))[i]
end
def DM_setPanel(v)
  require 'json'
  File.write('${outFile}', v.to_json)
end`,
    exceptionRewriter(msg: string, _: string) {
      return msg;
    },
  },

  julia: {
    name: 'Julia',
    defaultPath: 'julia',
    defaultContent: (panelIndex: number) => '',
    preamble: (outFile: string, resultsFile: string) => `
import JSON
function DM_getPanel(i)
  JSON.parsefile("${resultsFile}")[i+1]
end
function DM_setPanel(v)
  open("${outFile}", "w") do f
    JSON.print(f, v)
  end
end`,
    exceptionRewriter(msg: string, programPath: string) {
      const matcher = RegExp(
        `${programPath}:([1-9]*)`.replaceAll('/', '\\/'),
        'g'
      );

      return msg.replace(matcher, function (_: string, line: string) {
        return `${programPath}:${+line - LANGUAGES.julia.preamble('', '').split(EOL).length}`;
      });
    },
  },

  r: {
    name: 'R',
    defaultPath: 'Rscript',
    defaultContent: (panelIndex: number) => '',
    preamble: (outFile: string, resultsFile: string) => `
library("rjson")
DM_getPanel <- function(i) {
  fromJSON(file="${resultsFile}")[[i+1]]
}
DM_setPanel <- function(v) {
  write(toJSON(v), "${outFile}")
}`,
    exceptionRewriter(msg: string, _: string) {
      return msg;
    },
  },
};
