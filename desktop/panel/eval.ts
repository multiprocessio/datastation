import { execFile } from 'child_process';
import fs from 'fs';
import jsesc from 'jsesc';
import { EOL } from 'os';
import { preview } from 'preview';
import { shape, Shape } from 'shape';
import { file as makeTmpFile } from 'tmp-promise';
import * as uuid from 'uuid';
import {
  Cancelled,
  EVAL_ERRORS,
  InvalidDependentPanelError,
} from '../../shared/errors';
import log from '../../shared/log';
import { PanelBody } from '../../shared/rpc';
import {
  ConnectorInfo,
  DatabaseConnectorInfo,
  DatabasePanelInfo,
  FilePanelInfo,
  HTTPPanelInfo,
  LiteralPanelInfo,
  PanelInfo,
  PanelInfoType,
  PanelResult,
  ProjectState,
} from '../../shared/state';
import { getMimeType, XLSX_MIME_TYPE } from '../../shared/text';
import { DSPROJ_FLAG, PANEL_FLAG, PANEL_META_FLAG } from '../constants';
import { parsePartialJSONFile } from '../partial';
import { Dispatch, RPCHandler } from '../rpc';
import { flushUnwritten, getProjectResultsFile } from '../store';
import { additionalParsers } from './parquet';
import { getProjectAndPanel } from './shared';
import { EvalHandlerExtra, EvalHandlerResponse } from './types';

type EvalHandler = (
  project: ProjectState,
  panel: PanelInfo,
  extra: EvalHandlerExtra,
  dispatch: Dispatch
) => Promise<EvalHandlerResponse>;

const EVAL_HANDLERS: { [k in PanelInfoType]: () => EvalHandler } = {
  filagg: () => require('./filagg').evalFilterAggregate,
  file: () => require('./file').evalFile,
  http: () => require('./http').evalHTTP,
  program: () => require('./program').evalProgram,
  database: () => require('./database').evalDatabase,
  table: () => require('./columns').evalColumns,
  graph: () => require('./columns').evalColumns,
  literal: () => require('./columns').evalLiteral,
};

const runningProcesses: Record<string, Set<number>> = {};
const cancelledPids = new Set<number>();

function killAllByPanelId(panelId: string) {
  const workers = runningProcesses[panelId];
  if (workers) {
    Array.from(workers).map((pid) => {
      try {
        log.info('Killing existing process');
        process.kill(pid, 'SIGINT');
        cancelledPids.add(pid);
      } catch (e) {
        // If process doesn't exist, that's ok
        if (!e.message.includes('ESRCH')) {
          throw e;
        }
      }
    });
  }
}

function canUseGoRunner(panel: PanelInfo, connectors: ConnectorInfo[]) {
  if (panel.serverId) {
    return false;
  }

  const supportedDatabases = [
    'postgres',
    'sqlite',
    'mysql',
    'oracle',
    'sqlserver',
    'clickhouse',
  ];
  if (panel.type === 'database') {
    const dp = panel as DatabasePanelInfo;
    for (const c of connectors) {
      if (c.id === dp.database.connectorId) {
        const dc = c as DatabaseConnectorInfo;
        if (c.serverId) {
          return false;
        }

        return supportedDatabases.includes(dc.database.type);
      }
    }
    return false;
  }

  if (panel.type === 'program') {
    return true;
  }

  const fileLike = ['literal', 'http', 'file'].includes(panel.type);
  if (!fileLike) {
    return false;
  }

  const supportedTypes = [
    'text/csv',
    'application/json',
    'parquet',
    XLSX_MIME_TYPE,
    'application/vnd.ms-excel',
  ];
  let mimetype = '';
  if (panel.type === 'literal') {
    const lp = panel as LiteralPanelInfo;
    mimetype = getMimeType(
      {
        ...lp.literal.contentTypeInfo,
        additionalParsers,
      },
      ''
    );
  } else if (panel.type === 'http') {
    const hp = panel as HTTPPanelInfo;
    mimetype = getMimeType(
      {
        ...hp.http.http.contentTypeInfo,
        additionalParsers,
      },
      hp.http.http.url
    );
  } else {
    const fp = panel as FilePanelInfo;
    mimetype = getMimeType(
      {
        ...fp.file.contentTypeInfo,
        additionalParsers,
      },
      fp.file.name
    );
  }

  return supportedTypes.includes(mimetype);
}

export async function evalInSubprocess(
  subprocess: {
    node: string;
    go?: string;
  },
  projectName: string,
  panel: PanelInfo,
  connectors: ConnectorInfo[]
) {
  const tmp = await makeTmpFile({ prefix: 'resultmeta-' });
  let pid = 0;

  try {
    // This means only one user can run a panel at a time
    killAllByPanelId(panel.id);

    let base = process.argv[0];
    const args = [
      subprocess.node,
      DSPROJ_FLAG,
      projectName,
      PANEL_FLAG,
      panel.id,
      PANEL_META_FLAG,
      tmp.path,
    ];
    if (subprocess.go && canUseGoRunner(panel, connectors)) {
      base = subprocess.go;
      args.shift();
    }

    // https://blog.cloudflare.com/go-coverage-with-external-tests/
    if (subprocess.go && subprocess.go.includes('_test')) {
      args.unshift('-test.run');
      args.unshift('^TestRunMain$');
      args.unshift('-test.coverprofile=coverage/gorunner.' + uuid.v4() + '.cov');
    }

    log.info(`Launching "${base} ${args.join(' ')}"`);
    const child = execFile(base, args, {
      windowsHide: true,
    });

    pid = child.pid;
    if (!runningProcesses[panel.id]) {
      runningProcesses[panel.id] = new Set();
    }
    runningProcesses[panel.id].add(pid);

    let stderr = '';
    child.stderr.on('data', (data) => {
      // Can't find any way to suppress this error appearing in Node processes.
      if (data.includes('stream/web is an experimental feature.')) {
        return;
      }
      stderr += data;
      process.stderr.write(data);
    });

    child.stdout.on('data', (data) => {
      stderr += data;
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
            return;
          }

          if (cancelledPids.has(pid)) {
            cancelledPids.delete(pid);
            reject(new Cancelled());
            return;
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

    const resultMeta = fs.readFileSync(tmp.path).toString();
    let parsePartial = !resultMeta;
    if (!parsePartial) {
      const rm = JSON.parse(resultMeta);
      if (rm.exception) {
        const e =
          EVAL_ERRORS.find((e) => e.name === rm.exception.name) || Error;
        if ((e as any).fromJSON) {
          throw (e as any).fromJSON(rm.exception);
        }

        throw new e(rm.exception);
      }

      // Case of existing Node.js runner
      return rm;
    }

    // Case of new Go runner
    const projectResultsFile = getProjectResultsFile(projectName);
    return parsePartialJSONFile(projectResultsFile + panel.id);
  } finally {
    try {
      if (pid) {
        runningProcesses[panel.id].delete(pid);
      }

      tmp.cleanup();
    } catch (e) {
      log.error(e);
    }
  }
}

function assertValidDependentPanels(
  projectId: string,
  content: string,
  idMap: Record<string | number, string>
) {
  const projectResultsFile = getProjectResultsFile(projectId);
  const re =
    /(DM_getPanel\((?<number>[0-9]+)\))|(DM_getPanel\((?<singlequote>'(?:[^'\\]|\\.)*\')\))|(DM_getPanel\((?<doublequote>"(?:[^"\\]|\\.)*\")\))/g;
  let match = null;
  while ((match = re.exec(content)) !== null) {
    if (match && match.groups) {
      const { number, singlequote, doublequote } = match.groups;
      let m = doublequote || singlequote || number;
      if (["'", '"'].includes(m.charAt(0))) {
        m = m.slice(1, m.length - 1);
      }

      if (!fs.existsSync(projectResultsFile + idMap[m])) {
        throw new InvalidDependentPanelError(m);
      }
    }
  }
}

export const makeEvalHandler = (subprocessEval?: {
  node: string;
  go?: string;
}): RPCHandler<PanelBody, PanelResult> => ({
  resource: 'eval',
  handler: async function (
    projectId: string,
    body: PanelBody,
    dispatch: Dispatch
  ): Promise<PanelResult> {
    // Flushes desktop panel writes to disk. Not relevant in server context.
    flushUnwritten();

    const { project, panel, panelPage } = await getProjectAndPanel(
      dispatch,
      projectId,
      body.panelId
    );

    if (subprocessEval) {
      return evalInSubprocess(
        subprocessEval,
        project.projectName,
        panel,
        project.connectors
      );
    }

    const idMap: Record<string | number, string> = {};
    const idShapeMap: Record<string | number, Shape> = {};
    project.pages[panelPage].panels.forEach((p, i) => {
      idMap[i] = p.id;
      idMap[p.name] = p.id;
      idShapeMap[i] = p.resultMeta.shape;
      idShapeMap[p.name] = p.resultMeta.shape;
    });

    assertValidDependentPanels(projectId, panel.content, idMap);

    const evalHandler = EVAL_HANDLERS[panel.type]();
    const res = await evalHandler(
      project,
      panel,
      {
        idMap,
        idShapeMap,
      },
      dispatch
    );

    // TODO: is it a problem panels like Program skip this escaping?
    // This library is important for escaping responses otherwise some
    // characters can blow up various panel processes.
    const json = jsesc(res.value, { quotes: 'double', json: true });

    if (!res.skipWrite) {
      const projectResultsFile = getProjectResultsFile(projectId);
      fs.writeFileSync(projectResultsFile + panel.id, json);
    }

    const s = shape(res.value);

    return {
      stdout: res.stdout || '',
      preview: preview(res.value),
      shape: s,
      value: res.returnValue ? res.value : null,
      size: res.size === undefined ? json.length : res.size,
      arrayCount:
        res.arrayCount === undefined
          ? s.kind === 'array'
            ? (res.value || []).length
            : null
          : res.arrayCount,
      contentType: res.contentType || 'application/json',
    };
  },
});

export const killProcessHandler: RPCHandler<PanelBody, void> = {
  resource: 'killProcess',
  handler: async function (_: string, body: PanelBody) {
    killAllByPanelId(body.panelId);
  },
};
