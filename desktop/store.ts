import * as sqlite3 from 'better-sqlite3';
import { Buffer } from 'buffer';
import fs from 'fs';
import path from 'path';
import log from '../shared/log';
import { getPath } from '../shared/object';
import { Endpoint, GetProjectRequest, MakeProjectRequest } from '../shared/rpc';
import {
  ConnectorInfo,
  DatabasePanelInfo,
  doOnEncryptFields,
  Encrypt,
  FilePanelInfo,
  FilterAggregatePanelInfo,
  GraphPanelInfo,
  HTTPPanelInfo,
  LiteralPanelInfo,
  PanelInfo,
  PanelInfoType,
  PanelResult,
  ProgramPanelInfo,
  ProjectPage,
  ProjectState,
  ServerInfo,
  TablePanelInfo,
} from '../shared/state';
import { DISK_ROOT, PROJECT_EXTENSION } from './constants';
import {
  connectorCrud,
  GenericCrud,
  metadataCrud,
  pageCrud,
  panelCrud,
  serverCrud,
} from './crud';
import { ensureFile } from './fs';
import {
  DeleteConnectorHandler,
  DeletePageHandler,
  DeletePanelHandler,
  DeleteServerHandler,
  GetConnectorHandler,
  GetPageHandler,
  GetPanelHandler,
  GetProjectHandler,
  GetProjectsHandler,
  GetServerHandler,
  MakeProjectHandler,
  RPCHandler,
  UpdateConnectorHandler,
  UpdatePageHandler,
  UpdatePanelHandler,
  UpdateServerHandler,
} from './rpc';
import { encrypt } from './secret';

export function getProjectResultsFile(projectId: string) {
  const fileName = path
    .basename(projectId)
    .replace('.' + PROJECT_EXTENSION, '');
  const base = path.join(DISK_ROOT.value, '.' + fileName + '.results');
  ensureFile(base);
  return base;
}

function checkAndEncrypt(e: Encrypt, existing?: Encrypt) {
  existing = existing || new Encrypt('');
  const new_ = existing;

  if (e.value !== null && e.value !== undefined) {
    new_.value = e.value;
    new_.encrypted = e.encrypted;

    if (!e.encrypted) {
      new_.value = encrypt(e.value);
      new_.encrypted = true;
    }
  }

  return new_;
}

export function encryptProjectSecrets(s: any, existingState: any) {
  return doOnEncryptFields(s, (field: Encrypt, path: string) => {
    return checkAndEncrypt(field, getPath(existingState, path));
  });
}

function minSemver(real: string, min: string) {
  const realParts = real.split('.');
  const minParts = min.split('.');
  for (let i = 0; i < realParts.length; i++) {
    if (+realParts[i] < +minParts[i]) {
      return false;
    }
  }

  return true;
}

const FACTORIES: Record<PanelInfoType, (pageId: string) => PanelInfo> = {
  table: (pageId: string) => new TablePanelInfo(pageId),
  http: (pageId: string) => new HTTPPanelInfo(pageId),
  graph: (pageId: string) => new GraphPanelInfo(pageId),
  program: (pageId: string) => new ProgramPanelInfo(pageId),
  literal: (pageId: string) => new LiteralPanelInfo(pageId),
  database: (pageId: string) => new DatabasePanelInfo(pageId),
  file: (pageId: string) => new FilePanelInfo(pageId),
  filagg: (pageId: string) => new FilterAggregatePanelInfo(pageId),
};

// SOURCE: https://www.sqlite.org/fileformat.html
const SQLITE_HEADER = Buffer.from('53514c69746520666f726d6174203300', 'hex');

// SOURCE: https://phiresky.github.io/blog/2020/sqlite-performance-tuning/
const PRAGMAS = [
  'journal_mode = WAL',
  'synchronous = normal',
  'temp_store = memory',
  'mmap_size = 30000000000',
];

export class Store {
  stubMaker: () => () => string;
  constructor(stubMaker = () => () => '?') {
    this.stubMaker = stubMaker;
  }

  validateSQLiteDriver() {
    const memdb = new sqlite3.default(':memory:');
    const stmt = memdb.prepare('SELECT sqlite_version() AS version');
    const row = stmt.get();
    if (!minSemver(row.version, '3.38.1')) {
      throw new Error(
        'Unsupported SQLite driver version: ' + JSON.stringify(row)
      );
    }
  }

  pool: Record<string, sqlite3.Database> = {};
  firstTime: boolean = true;
  getConnection(projectId: string) {
    if (this.firstTime) {
      this.validateSQLiteDriver();
      this.firstTime = false;
    }

    const filename = ensureProjectFile(projectId);
    if (!this.pool[filename]) {
      this.pool[filename] = new sqlite3.default(filename);
      for (const pragma of PRAGMAS) {
        this.pool[filename].pragma(pragma);
      }
    }

    return this.pool[filename];
  }

  getProjectsHandler: GetProjectsHandler = {
    resource: 'getProjects',
    handler: async () => {
      const files = fs
        .readdirSync(DISK_ROOT.value)
        .filter((f) => f.endsWith('.' + PROJECT_EXTENSION))
        .map((f) => {
          const createdAt = fs
            .statSync(path.join(DISK_ROOT.value, f))
            .birthtime.toISOString();
          const name = f.slice(0, f.length - ('.' + PROJECT_EXTENSION).length);
          return { createdAt, name };
        });
      files.sort();
      return files;
    },
  };

  isSQLiteFile(f: string) {
    const fd = fs.openSync(f, 'r');
    const buf = Buffer.from(new ArrayBuffer(16));
    const n = fs.readSync(fd, buf);
    fs.closeSync(fd);
    return n == 16 && buf.equals(SQLITE_HEADER);
  }

  async migrateFromJSON(projectId: string) {
    const f = ensureProjectFile(projectId);
    // If it's already SQLite, do nothing.
    if (this.isSQLiteFile(f)) {
      return;
    }

    // Make a backup
    const fbak = f + '.bak';
    try {
      fs.copyFileSync(f, fbak);
    } catch (e) {
      throw new Error('Could not make a backup of old project file: ' + e);
    }

    // Erase old file
    try {
      fs.unlinkSync(f);
    } catch (e) {
      throw new Error('Could not overwrite old project file: ' + e);
    }

    // Read original for copying to SQLite
    const project = JSON.parse(fs.readFileSync(fbak).toString());

    // Write out the SQLite version
    await this.makeProjectHandler.handler(null, { projectId }, null, false);

    for (let i = 0; i < project.pages.length; i++) {
      const page = project.pages[i];
      await this.updatePageHandler.handler(
        project.projectName,
        {
          data: { ...page },
          position: i,
        },
        null,
        false
      );

      const panels = page.panels;
      for (let j = 0; j < panels.length; j++) {
        panels[j].pageId = page.id;
        await this.updatePanelHandler.handler(
          project.projectName,
          {
            data: panels[j],
            position: j,
          },
          null,
          false
        );
      }
    }

    for (let i = 0; i < project.servers.length; i++) {
      const server = project.servers[i];
      await this.updateServerHandler.handler(
        project.projectName,
        {
          data: server,
          position: i,
        },
        null,
        false
      );
    }

    for (let i = 0; i < project.connectors.length; i++) {
      const connector = project.connectors[i];
      await this.updateConnectorHandler.handler(
        project.projectName,
        {
          data: connector,
          position: i,
        },
        null,
        false
      );
    }
  }

  getPageHandler: GetPageHandler = {
    resource: 'getPage',
    handler: async (projectId: string, { id }: { id: string }) => {
      const db = this.getConnection(projectId);
      return pageCrud.getOne(db, id)[0];
    },
  };

  getPanelHandler: GetPanelHandler = {
    resource: 'getPanel',
    handler: async (projectId: string, { id }: { id: string }) => {
      const db = this.getConnection(projectId);
      return panelCrud.getOne(db, id)[0];
    },
  };

  getConnectorHandler: GetConnectorHandler = {
    resource: 'getConnector',
    handler: async (projectId: string, { id }: { id: string }) => {
      const db = this.getConnection(projectId);
      return connectorCrud.getOne(db, id)[0];
    },
  };

  getServerHandler: GetServerHandler = {
    resource: 'getServer',
    handler: async (projectId: string, { id }: { id: string }) => {
      const db = this.getConnection(projectId);
      return serverCrud.getOne(db, id)[0];
    },
  };

  getProjectHandler: GetProjectHandler = {
    resource: 'getProject',
    handler: async (
      _0: string,
      { projectId }: GetProjectRequest,
      _1: unknown,
      external: boolean
    ) => {
      await this.migrateFromJSON(projectId);

      const db = this.getConnection(projectId);
      const [metadata, servers, pages, panels, connectors] = [
        metadataCrud.get(db),
        serverCrud.get(db),
        pageCrud.get(db),
        panelCrud.get(db),
        connectorCrud.get(db),
      ];
      const rawProject: any = metadata;
      rawProject.connectors = connectors;
      rawProject.servers = servers;

      const stmt = db.prepare(`
SELECT
  panel_id,
  (
    SELECT data_json
    FROM ds_result i
    WHERE i.panel_id = o.panel_id
    ORDER BY created_at DESC
    LIMIT 1
  ) data_json
FROM ds_result o
GROUP BY panel_id
`);
      const results = stmt.all();

      const resultPanelMap: Record<string, PanelResult> = {};
      for (const result of results) {
        resultPanelMap[result.panel_id] = JSON.parse(result.data_json);
      }

      const panelPageMap: Record<string, Array<PanelInfo>> = {};
      for (const panel of panels) {
        panel.resultMeta = resultPanelMap[panel.id];

        if (!panelPageMap[panel.pageId]) {
          panelPageMap[panel.pageId] = [];
        }

        panelPageMap[panel.pageId].push(panel);
      }

      for (const page of pages) {
        page.panels = panelPageMap[page.id] || [];
      }
      rawProject.pages = pages;

      return ProjectState.fromJSON(rawProject, external);
    },
  };

  makeProjectHandler: MakeProjectHandler = {
    resource: 'makeProject',

    // NOTE: unlike elsewhere projectId is actually the file name not a uuid.
    handler: async (_: string, { projectId }: MakeProjectRequest) => {
      const db = this.getConnection(projectId);
      const newProject = new ProjectState();
      newProject.projectName = ensureProjectFile(projectId);
      const migrationsBase = path.join(__dirname, 'migrations');
      const files = fs
        .readdirSync(migrationsBase)
        .filter((f) => f.endsWith('.sql'));
      files.sort();
      for (const file of files) {
        log.info('Running migration: ' + file);
        const contents = fs
          .readFileSync(path.join(migrationsBase, file))
          .toString();
        db.exec(contents);
        log.info('Done migration: ' + file);
      }

      const metadata: Record<string, string> = {};
      for (const [key, value] of Object.entries(newProject)) {
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          metadata[key] = String(value);
        }
      }
      metadataCrud.insert(db, metadata);
    },
  };

  updateGeneric<T extends { id: string }>(
    crud: GenericCrud<T>,
    projectId: string,
    data: T,
    position: number,
    factory: () => T,
    foreignKey?: {
      column: string;
      value: string;
    },
    shortcircuit?: (
      db: sqlite3.Database,
      existingObj: T,
      existingPosition: number
    ) => boolean
  ) {
    const db = this.getConnection(projectId);
    db.transaction(() => {
      const [existing, existingPosition] = crud.getOne(db, data.id);
      if (!existing) {
        log.info(`Updating ${crud.entity}`);
        encryptProjectSecrets(data, factory());
        crud.insert(db, data, position, foreignKey);
        return;
      }

      if (shortcircuit) {
        const stop = shortcircuit(db, existing, existingPosition);
        if (stop) {
          return;
        }
      }

      encryptProjectSecrets(data, existing);
      log.info(`Inserting ${crud.entity}`);
      crud.update(db, data);
    })();
  }

  guardInternalOnly = (external: boolean) => {
    if (external) {
      throw new Error('Bad access.');
    }
  };

  updatePanelResultHandler = {
    resource: 'updatePanelResult' as Endpoint,
    handler: async (
      projectId: string,
      body: {
        panelId: string;
        data: PanelResult;
      },
      _: unknown,
      external: boolean
    ) => {
      this.guardInternalOnly(external);

      const db = this.getConnection(projectId);
      const stmt = db.prepare(
        `UPDATE "ds_result" SET created_at = STRFTIME('%s', 'now'), data_json = ? WHERE panel_id = ?;`
      );
      const res = stmt.run(JSON.stringify(body.data), body.panelId);
      if (res.changes === 0) {
        const stmt = db.prepare(
          `INSERT INTO "ds_result" (data_json, created_at, panel_id) VALUES(?, STRFTIME('%s', 'now'), ?);`
        );
        stmt.run(JSON.stringify(body.data), body.panelId);
      }
    },
  };

  updatePanelHandler: UpdatePanelHandler = {
    resource: 'updatePanel',
    handler: async (
      projectId: string,
      {
        data,
        position,
      }: {
        data: PanelInfo;
        position: number;
      }
    ) => {
      data.lastEdited = new Date();
      delete data.resultMeta;
      return this.updateGeneric(
        panelCrud,
        projectId,
        data,
        position,
        () => FACTORIES[data.type](data.pageId),
        {
          column: 'page_id',
          value: data.pageId,
        },
        (
          db: sqlite3.Database,
          existing: PanelInfo,
          existingPosition: number
        ) => {
          if (position === existingPosition) {
            return false;
          }

          // If updating position, do that in one dedicated step.
          // Nothing else can be updated with it.
          // This is all the UI needs at the moment anyway
          const allExisting = panelCrud.get(db, {
            q: `page_id = ?`,
            args: [data.pageId],
          });

          allExisting.splice(existingPosition, 1);
          allExisting.splice(position, 0, data);
          const stmt = db.prepare(
            `UPDATE ${panelCrud.entity} SET position = ? WHERE id = ?`
          );
          for (const i of allExisting.map((_, i) => i)) {
            stmt.run(i, allExisting[i].id);
          }
          return true;
        }
      );
    },
  };

  updatePageHandler: UpdatePageHandler = {
    resource: 'updatePage',
    handler: async (
      projectId: string,
      {
        data,
        position,
      }: {
        data: ProjectPage;
        position: number;
      }
    ) => {
      delete data.panels;
      this.updateGeneric(
        pageCrud,
        projectId,
        data,
        position,
        () => new ProjectPage()
      );
    },
  };

  updateConnectorHandler: UpdateConnectorHandler = {
    resource: 'updateConnector',
    handler: async (
      projectId: string,
      {
        data,
        position,
      }: {
        data: ConnectorInfo;
        position: number;
      }
    ) =>
      this.updateGeneric(
        connectorCrud,
        projectId,
        data,
        position,
        () => new ConnectorInfo()
      ),
  };

  updateServerHandler: UpdateServerHandler = {
    resource: 'updateServer',
    handler: async (
      projectId: string,
      {
        data,
        position,
      }: {
        data: ServerInfo;
        position: number;
      }
    ) =>
      this.updateGeneric(
        serverCrud,
        projectId,
        data,
        position,
        () => new ServerInfo()
      ),
  };

  deleteGeneric<T extends { id: string }>(
    crud: GenericCrud<T>,
    projectId: string,
    id: string
  ) {
    const db = this.getConnection(projectId);

    crud.del(db, id);
  }

  deleteServerHandler: DeleteServerHandler = {
    resource: 'deleteServer',
    handler: async (
      projectId: string,
      {
        id,
      }: {
        id: string;
      }
    ) => this.deleteGeneric(serverCrud, projectId, id),
  };

  deleteConnectorHandler: DeleteConnectorHandler = {
    resource: 'deleteConnector',
    handler: async (
      projectId: string,
      {
        id,
      }: {
        id: string;
      }
    ) => this.deleteGeneric(connectorCrud, projectId, id),
  };

  deletePageHandler: DeletePageHandler = {
    resource: 'deletePage',
    handler: async (
      projectId: string,
      {
        id,
      }: {
        id: string;
      }
    ) => this.deleteGeneric(pageCrud, projectId, id),
  };

  deletePanelHandler: DeletePanelHandler = {
    resource: 'deletePanel',
    handler: async (
      projectId: string,
      {
        id,
      }: {
        id: string;
      }
    ) => this.deleteGeneric(panelCrud, projectId, id),
  };

  // Break handlers out so they can be individually typed without `any`,
  // only brought here and masked as `any`.
  getHandlers(): RPCHandler<any, any>[] {
    return [
      this.getProjectHandler,
      this.getProjectsHandler,
      this.updatePanelHandler,
      this.updateConnectorHandler,
      this.updatePageHandler,
      this.updateServerHandler,
      this.deletePanelHandler,
      this.deleteConnectorHandler,
      this.deletePageHandler,
      this.deleteServerHandler,
      this.makeProjectHandler,
      this.updatePanelResultHandler,
    ];
  }
}

export function ensureProjectFile(projectId: string) {
  const ext = '.' + PROJECT_EXTENSION;
  return ensureFile(projectId + (projectId.endsWith(ext) ? '' : ext));
}
