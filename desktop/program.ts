import fs from 'fs/promises';
import util from 'util';
import { exec } from 'child_process';

import { file as makeTmpFile } from 'tmp-promise';

import { ProgramPanelInfo } from '../shared/state';
import { parseArrayBuffer } from '../shared/text';

const execPromise = util.promisify(exec);

export const evalProgramHandler = {
  resource: 'evalProgram',
  handler: async function (_: string, ppi: ProgramPanelInfo) {
    const programTmp = await makeTmpFile();
    const outputTmp = await makeTmpFile();

    try {
      const matcher = /DM_setPanel\(([a-Z-A-Z_\$0-9]+)\)/g;
      const program = ppi.content.replace(
        matcher,
        function (match, panelResult) {
          if (ppi.program.type === 'javascript') {
            return `(() => { const fs = require('fs'); fs.writeFileSync('${outputTmp.path}', JSON.stringify(${match})) })()`;
          } else {
            return `with open('${outputTmp}', 'w') as f: import json; f.write(json.dumps(${match}))`;
          }
        }
      );
      await fs.writeFile(programTmp.path, program);
      const runtime = ppi.program.type === 'javascript' ? 'node' : 'python3';
      const { stdout } = await execPromise(`${runtime} ${programTmp.path}`);
      const body = await fs.readFile(outputTmp.path);
      return [await parseArrayBuffer('application/json', '', body), stdout];
    } finally {
      programTmp.cleanup();
      outputTmp.cleanup();
    }
  },
};
