import asar from 'asar';
import * as sqlite3 from 'better-sqlite3';
import { Buffer } from 'buffer';
import fs from 'fs';
import path from 'path';
import log from '../shared/log';
import { getPath } from '../shared/object';
import { GetProjectRequest, MakeProjectRequest } from '../shared/rpc';
import {
  ConnectorInfo,
  DatabaseConnectorInfo,
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
import { CODE_ROOT, DISK_ROOT, PROJECT_EXTENSION } from './constants';
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

export function getMigrations() {
  const migrationsBase = path.join(__dirname, 'migrations');
  const migrations = fs
    .readdirSync(migrationsBase)
    .filter((f) => f.endsWith('.sql'))
    .map((file) => path.join(migrationsBase, file));
  migrations.sort();
  return migrations;
}

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
    if (+realParts[i] > +minParts[i]) {
      return true;
    }

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
  migrations: Array<string>;
  constructor(stubMaker = () => () => '?', migrations = getMigrations()) {
    this.stubMaker = stubMaker;
    this.migrations = migrations;
  }

  validateSQLiteDriver() {
    const memdb = new sqlite3.default(':memory:');
    const stmt = memdb.prepare('SELECT sqlite_version() AS version');
    const row = stmt.get() as { version: string };
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

    if (!projectId) {
      throw new Error('Expected a project id.');
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
      // Sort timestamp DESC
      files.sort(
        (a, b) =>
          new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf()
      );
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
          insert: true,
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
            insert: true,
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
          insert: true,
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
          insert: true,
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
      const results = stmt.all() as Array<{
        panel_id: string;
        data_json: string;
      }>;

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

  // Example: /private/var/folders/l0/51ds3d1d2214wb1y0vbtl5qr0000gn/T/AppTranslocation/6AC58880-BE22-4AB7-8006-47D9764BC590/d/DataStation Desktop CE.app/Contents/Resources/app.asar/sampledata/nginx_logs.jsonl
  unmangleAsar(file: string): string {
    const asarName = 'app.asar';
    if (!file.includes(asarName)) {
      return file;
    }

    // Since Go reads from the filesystem it doesn't look into the asar that is used in release builds. So we need to extract it if it doesn't exist.
    const [asarParent, fileName] = file.split(asarName);
    const asarFile = asarParent + asarName;
    const newFile = path.join(asarParent, fileName);
    // TODO: if these files change then checksum will be needed
    if (!fs.existsSync(newFile)) {
      fs.mkdirSync(path.dirname(newFile), { recursive: true });
      fs.writeFileSync(
        newFile,
        asar.extractFile(asarFile, fileName.slice(1) /* drop leading / */)
      );
    }

    return newFile;
  }

  cleanupSampleProject(sampleProject: ProjectState) {
    for (const page of sampleProject.pages || []) {
      for (const panel of page.panels || []) {
        if (panel.type === 'file') {
          const fp = panel as FilePanelInfo;
          if (fp.file.name.startsWith('sampledata')) {
            fp.file.name = this.unmangleAsar(
              path.join(CODE_ROOT, fp.file.name)
            );
          }
        }
      }
    }

    for (const con of sampleProject.connectors || []) {
      if (con.type === 'database') {
        const dc = con as DatabaseConnectorInfo;
        if (
          dc.database.type === 'sqlite' &&
          dc.database.database.startsWith('sampledata')
        ) {
          dc.database.database = this.unmangleAsar(
            path.join(CODE_ROOT, dc.database.database)
          );
        }
      }
    }
  }

  makeProjectHandler: MakeProjectHandler = {
    resource: 'makeProject',

    // NOTE: unlike elsewhere projectId is actually the file name not a uuid.
    handler: async (_: string, request: MakeProjectRequest) => {
      const { projectId } = request;

      const newProject = request.project
        ? ProjectState.fromJSON(request.project)
        : new ProjectState();
      newProject.projectName = ensureProjectFile(projectId);

      // Sample projects get submitted and written as JSON. They get ported to SQLite on first read.
      if (request.project) {
        this.cleanupSampleProject(newProject);
        fs.writeFileSync(newProject.projectName, JSON.stringify(newProject));
        return;
      }

      // File already exists, ok and appropriate to do nothing since
      // this merely handles creation not loading.
      if (fs.existsSync(newProject.projectName)) {
        return;
      }

      const db = this.getConnection(projectId);
      for (const file of this.migrations) {
        log.info('Running migration: ' + file);
        const contents = fs.readFileSync(file).toString();
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

  updateGeneric<T extends { id: string; defaultModified: boolean }>(
    crud: GenericCrud<T>,
    projectId: string,
    data: T,
    position: number,
    insert: boolean,
    factory: () => T,
    foreignKey?: {
      column: string;
      value: string;
    }
  ) {
    const db = this.getConnection(projectId);
    db.transaction(() => {
      if (insert) {
        log.info(`Inserting ${crud.entity}`);
        encryptProjectSecrets(data, factory());
        crud.insert(db, data, position, foreignKey);
        return;
      }

      data.defaultModified = true;
      const [existing] = crud.getOne(db, data.id);
      encryptProjectSecrets(data, existing);
      log.info(`Updating ${crud.entity}`);
      crud.update(db, data);
    })();
  }

  guardInternalOnly = (external: boolean) => {
    if (external) {
      throw new Error('Bad access.');
    }
  };

  updatePanelResultHandler: RPCHandler<any, any, any> = {
    resource: 'updatePanelResult',
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
        insert,
        panelPositions,
      }: {
        data: PanelInfo;
        position: number;
        insert: boolean;
        panelPositions: string[];
      }
    ) => {
      data.lastEdited = new Date();
      delete data.resultMeta;
      await this.updateGeneric(
        panelCrud,
        projectId,
        data,
        position,
        insert,
        () => FACTORIES[data.type](data.pageId),
        {
          column: 'page_id',
          value: data.pageId,
        }
      );

      if (panelPositions) {
        const db = this.getConnection(projectId);
        // Don't trust the UI to be up-to-date with all existing panels
        // So fetch the existing ones
        const getStmt = db.prepare(
          `SELECT id FROM ${panelCrud.entity} WHERE page_id = ?`
        );
        const allExisting = getStmt.all(data.pageId) as Array<{ id: string }>;

        // Then sort the existing ones based on the positions passed in
        allExisting.sort((a, b) => {
          const ao = panelPositions.indexOf(a.id);
          const bo = panelPositions.indexOf(b.id);

          // Put unknown items at the end
          if (ao === -1) {
            return 1;
          }

          return ao - bo;
        });

        const stmt = db.prepare(
          `UPDATE ${panelCrud.entity} SET position = ? WHERE id = ?`
        );
        for (const i of panelPositions.map((_, i) => i)) {
          stmt.run(i, panelPositions[i]);
        }
      }
    },
  };

  updatePageHandler: UpdatePageHandler = {
    resource: 'updatePage',
    handler: async (
      projectId: string,
      {
        data,
        position,
        insert,
      }: {
        data: ProjectPage;
        position: number;
        insert: boolean;
      }
    ) => {
      delete data.panels;
      this.updateGeneric(
        pageCrud,
        projectId,
        data,
        position,
        insert,
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
        insert,
      }: {
        data: ConnectorInfo;
        position: number;
        insert: boolean;
      }
    ) =>
      this.updateGeneric(
        connectorCrud,
        projectId,
        data,
        position,
        insert,
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
        insert,
      }: {
        data: ServerInfo;
        position: number;
        insert: boolean;
      }
    ) =>
      this.updateGeneric(
        serverCrud,
        projectId,
        data,
        position,
        insert,
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
  getHandlers(): RPCHandler<any, any, any>[] {
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
