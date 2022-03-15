import * as sqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import log from '../shared/log';
import { getPath } from '../shared/object';
import { GetProjectRequest, MakeProjectRequest } from '../shared/rpc';
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
  GetProjectHandler,
  GetProjectsHandler,
  InternalEndpoint,
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

export class Store {
  firstTime: boolean = true;

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

  getConnection(projectId: string) {
    if (this.firstTime) {
      this.validateSQLiteDriver();
      this.firstTime = false;
    }

    const filename = ensureProjectFile(projectId);
    return new sqlite3.default(filename);
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

  getProjectHandler: GetProjectHandler = {
    resource: 'getProject',
    handler: async (
      _0: string,
      { projectId }: GetProjectRequest,
      _1: unknown,
      external: boolean
    ) => {
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

    // TODO: also need to handle migration from old dsproj format

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
        log.info(`Updating ${crud.entity}: ${data}`);
        encryptProjectSecrets(data, factory());
        crud.insert(db, data, position);
        return;
      }

      if (shortcircuit) {
        const stop = shortcircuit(db, existing, existingPosition);
        if (stop) {
          return;
        }
      }

      encryptProjectSecrets(data, existing);
      log.info(`Inserting ${crud.entity}: ${data}`);
      crud.update(db, data);
    })();
  }

  // INTERNAL ONLY
  updatePanelResultHandler = {
    resource: 'updatePanelResult' as InternalEndpoint,
    handler: async (
      projectId: string,
      body: {
        panelId: string;
        resultMeta: PanelResult;
      }
    ) => {
      const db = this.getConnection(projectId);
      const stmt = db.prepare(
        `REPLACE INTO "ds_result" (panel_id, created_at, data_json) VALUES (?, STRFTIME('%s', 'now'), ?)`
      );
      stmt.run(body.panelId, JSON.stringify(body.resultMeta));
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
        () => {
          const factories: Record<PanelInfoType, () => PanelInfo> = {
            table: () => new TablePanelInfo(data.pageId),
            http: () => new HTTPPanelInfo(data.pageId),
            graph: () => new GraphPanelInfo(data.pageId),
            program: () => new ProgramPanelInfo(data.pageId),
            literal: () => new LiteralPanelInfo(data.pageId),
            database: () => new DatabasePanelInfo(data.pageId),
            file: () => new FilePanelInfo(data.pageId),
            filagg: () => new FilterAggregatePanelInfo(data.pageId),
          };
          return factories[data.type]();
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
            q: `data_json->>'pageId' = ?`,
            args: [data.pageId],
          });

          allExisting.splice(existingPosition, 1);
          allExisting.splice(position, 0, data);
          const stmt = db.prepare(
            `UPDATE ${panelCrud.entity} SET position = ? WHERE id = ?`
          );
          for (const i of allExisting.map((_, i) => i)) {
            stmt.bind([i, allExisting[i].id]);
            stmt.run();
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
      delete data.schedules;
      log.info('START UPDATE PAGE');
      this.updateGeneric(
        pageCrud,
        projectId,
        data,
        position,
        () => new ProjectPage()
      );
      log.info('DONE UPDATE PAGE');
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
    ) => {
      const db = this.getConnection(projectId);
      db.transaction(() => {
        pageCrud.del(db, id);
        // Page and all panels must be deleted
        const stmt = db.prepare(
          `DELETE FROM "${panelCrud.entity}" WHERE data_json->>'pageId' = ?`
        );
        stmt.run(id);
      })();
    },
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
