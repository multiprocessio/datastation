import fs from 'fs';
import path from 'path';
import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
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
  GetProjectHandler,
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
  const base = path.join(DISK_ROOT, '.' + fileName + '.results');
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

sqlite3.verbose();
export class Store {
  async getConnection(projectId: string): Promise<sqlite.Database> {
    const filename = ensureProjectFile(projectId);
    // Connections must not be pooled, so that they are properly isolated.
    // https://github.com/mapbox/node-sqlite3/issues/304
    return await sqlite.open({
      filename,
      driver: sqlite3.Database,
    });
  }

  getProjectHandler: GetProjectHandler = {
    resource: 'getProject',
    handler: async (
      _0: string,
      { projectId }: GetProjectRequest,
      _1: unknown,
      external: boolean
    ) => {
      const db = await this.getConnection(projectId);
      const [metadata, servers, pages, panels, connectors] = await Promise.all([
        metadataCrud.get(db),
        serverCrud.get(db),
        pageCrud.get(db),
        panelCrud.get(db),
        connectorCrud.get(db),
      ]);
      const rawProject: any = metadata;
      rawProject.connectors = connectors;
      rawProject.servers = servers;

      for (const page of pages) {
        page.panels = [];
        for (const panel of panels) {
          if (page.id === panel.pageId) {
            page.panels.push(panel);
          }
        }
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
      const db = await this.getConnection(projectId);
      const newProject = new ProjectState();
      newProject.projectName = ensureProjectFile(projectId);
      const migrationsBase = path.join(__dirname, 'migrations');
      const files = fs.readdirSync(migrationsBase);
      files.sort();
      for (const file of files) {
        log.info('Running migration: ' + file);
        const contents = fs
          .readFileSync(path.join(migrationsBase, file))
          .toString();
        await db.exec(contents);
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
      await metadataCrud.update(db, metadata);
    },
  };

  async updateGeneric<T extends { id: string }>(
    crud: GenericCrud<T>,
    projectId: string,
    data: T,
    position: number,
    factory: () => T,
    shortcircuit?: (
      db: sqlite.Database,
      existingObj: T,
      existingPosition: number
    ) => Promise<boolean>
  ) {
    const db = await this.getConnection(projectId);

    const [existing, existingPosition] = await crud.getOne(db, data.id);
    if (!existing) {
      encryptProjectSecrets(data, factory());
      await crud.insert(db, data, position);
      return;
    }

    if (shortcircuit) {
      const stop = await shortcircuit(db, existing, existingPosition);
      if (stop) {
        return;
      }
    }

    encryptProjectSecrets(data, existing);
    await crud.update(db, data);
  }

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
        async (
          db: sqlite.Database,
          existing: PanelInfo,
          existingPosition: number
        ) => {
          if (position === existingPosition) {
            return false;
          }

          // If updating position, do that in one dedicated step.
          // Nothing else can be updated with it.
          // This is all the UI needs at the moment anyway
          const allExisting = await panelCrud.get(db, {
            q: `data_json->>'pageId' = ?`,
            args: [],
          });

          allExisting.splice(existingPosition, 1);
          allExisting.splice(position, 0, data);
          const stmt = await db.prepare(
            `UPDATE ${panelCrud.entity} SET position = ? WHERE id = ?`
          );
          for (const i of allExisting.map((_, i) => i)) {
            await stmt.bind([i, allExisting[i].id]);
            await stmt.run();
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
    ) =>
      this.updateGeneric(
        pageCrud,
        projectId,
        data,
        position,
        () => new ProjectPage()
      ),
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

  // Break handlers out so they can be individually typed without `any`,
  // only brought here and masked as `any`.
  getHandlers(): RPCHandler<any, any>[] {
    return [
      this.getProjectHandler,
      this.updatePanelHandler,
      this.updateConnectorHandler,
      this.updatePageHandler,
      this.updateServerHandler,
      this.makeProjectHandler,
    ];
  }
}

export function ensureProjectFile(projectId: string) {
  const ext = '.' + PROJECT_EXTENSION;
  return ensureFile(projectId + (projectId.endsWith(ext) ? '' : ext));
}
