import { Cancelled } from '@datastation/shared/errors';
import log from '@datastation/shared/log';
import { PanelBody } from '@datastation/shared/rpc';
import { PanelResult } from '@datastation/shared/state';
import { execFile } from 'child_process';
import fs from 'fs';
import { EOL } from 'os';
import { file as makeTmpFile } from 'tmp-promise';
import { DSPROJ_FLAG, PANEL_FLAG, PANEL_META_FLAG } from './constants';
import { Dispatch, RPCHandler } from './rpc';
import { flushUnwritten } from './store';

const runningProcesses: Record<string, Set<number>> = {};

function killAllByPanelId(panelId: string) {
  const workers = runningProcesses[panelId];
  if (workers) {
    Array.from(workers).map((pid) => {
      try {
        process.kill(pid, 'SIGINT');
      } catch (e) {
        // If process doesn't exist, that's ok
        if (!e.message.includes('ESRCH')) {
          throw e;
        }
      }
    });
  }
}

export const makeEvalHandler = (
  runner: string
): RPCHandler<PanelBody, PanelResult> => ({
  resource: 'eval',
  handler: async function (
    projectId: string,
    body: PanelBody,
    dispatch: Dispatch
  ): Promise<PanelResult> {
    // Flushes desktop panel writes to disk. Not relevant in server context.
    flushUnwritten();

    const tmp = await makeTmpFile({ prefix: 'resultmeta-' });
    let pid = 0;

    try {
      // This means only one user can run a panel at a time
      killAllByPanelId(body.panelId);

      const child = execFile(
        runner,
        [
          DSPROJ_FLAG,
          projectId,
          PANEL_FLAG,
          body.panelId,
          PANEL_META_FLAG,
          tmp.path,
        ],
        {
          windowsHide: true,
        }
      );

      pid = child.pid;
      if (!runningProcesses[body.panelId]) {
        runningProcesses[body.panelId] = new Set();
      }
      runningProcesses[body.panelId].add(pid);

      let stderr = '';
      child.stderr.on('data', (data) => {
        // Can't find any way to suppress this error appearing in Node processes.
        if (data.includes('stream/web is an experimental feature.')) {
          return;
        }
        stderr += data;
      });

      child.stdout.on('data', (data) => {
        process.stdout.write(data);
      });

      await new Promise<void>((resolve, reject) => {
        try {
          child.on('exit', (code) => {
            if (code === 0) {
              if (stderr) {
                process.stderr.write(stderr + EOL);
              }
              resolve();
            }

            if (code === 1 || code === null) {
              reject(new Cancelled());
            }

            reject(new Error(stderr));
          });
        } catch (e) {
          if (stderr) {
            process.stderr.write(stderr + EOL);
          }
          reject(e);
        }
      });

      const resultMeta = fs.readFileSync(tmp.path);
      return JSON.parse(resultMeta.toString());
    } finally {
      try {
        if (pid) {
          runningProcesses[body.panelId].delete(pid);
        }

        tmp.cleanup();
      } catch (e) {
        log.error(e);
      }
    }
  },
});

export const killProcessHandler: RPCHandler<PanelBody, void> = {
  resource: 'killProcess',
  handler: async function (_: string, body: PanelBody) {
    killAllByPanelId(body.panelId);
  },
};
