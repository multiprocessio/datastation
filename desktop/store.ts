import fs from 'fs';
import path from 'path';
import sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
import log from '../shared/log';
import { getPath } from '../shared/object';
import { GetProjectRequest, MakeProjectRequest } from '../shared/rpc';
import {
  ConnectorInfo,
  doOnEncryptFields,
  Encrypt,
  PanelInfo,
  ProjectState,
  ServerInfo,
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

export class Store {
  connections: Record<string, sqlite.Database> = {};

  async getConnection(projectId: string): Promise<sqlite.Database> {
    if (this.connections[projectId]) {
      return this.connections[projectId];
    }

    const filename = ensureProjectFile(projectId);
    return (this.connections[projectId] = await sqlite.open({
      filename,
      driver: sqlite3.Database,
    }));
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
    // NOTE: unlike elsewhere projectId is actually the file name not a uuid.
    handler: async (_: string, { projectId }: MakeProjectRequest) => {
      const db = await this.getConnection(projectId);
      const newProject = new ProjectState();
      newProject.projectName = projectId;
      const files = fs.readdirSync(path.join(__dirname, 'migrations'));
      files.sort();
      for (const file of files) {
        log.info('Running migration: ' + file);
        const contents = fs.readFileSync(file).toString();
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

  async updateGeneric<T extends { id: string; position: number }>(
    crud: GenericCrud<T>,
    projectId: string,
    p: T,
    factory: () => T,
    shortcircuit?: (db: sqlite.Database, existingObj: T) => Promise<boolean>
  ) {
    const db = await this.getConnection(projectId);
    await db.run('BEGIN EXCLUSIVE');
    try {
      const existing = await crud.getOne(db, p.id);
      if (!existing) {
        encryptProjectSecrets(p, factory());
        await crud.insert(db, p, p.position);
        return;
      }

      if (shortcircuit) {
        const stop = await shortcircuit(db, existing);
        if (stop) {
          return;
        }
      }

      encryptProjectSecrets(p, existing);
      await crud.update(db, p);

      await db.run('COMMIT');
    } catch (e) {
      await db.run('ROLLBACK');
    }
  }

  updatePanelHandler: UpdatePanelHandler = {
    resource: 'updatePanel',
    handler: async (projectId: string, p: PanelInfo & { position: number }) => {
      return this.updateGeneric<PanelInfo & { position: number }>(
        panelCrud,
        projectId,
        p,
        () => new PanelInfo(p.type),
        async (db, existing) => {
          if (p.position === existing.position) {
            return false;
          }

          // If updating position, do that in one dedicated step.
          // Nothing else can be updated with it.
          // This is all the UI needs at the moment anyway
          const allExisting = await panelCrud.get(db, {
            q: `json_data->>'pageId' = ?`,
            args: [],
          });

          allExisting.splice(existing.position, 1);
          allExisting.splice(p.position, 0, p);
          const stmt = await db.prepare(
            `UPDATE ${panelCrud.entity} SET position = ? WHERE id = ?`
          );
          for (const i of allExisting.map((_, i) => i)) {
            await stmt.bind([i, allExisting[i].id]);
          }
          await stmt.run();
          return true;
        }
      );
    },
  };

  updatePageHandler: UpdatePageHandler = {
    resource: 'updatePage',
    handler: async (projectId: string, p: PageInfo & { position: number }) =>
      this.updateGeneric<PageInfo & { position: number }>(
        projectCrud,
        projectId,
        p,
        () => new PageInfo()
      ),
  };

  updateConnectorHandler: UpdateConnectorHandler = {
    resource: 'updateConnector',
    handler: async (
      projectId: string,
      p: ConnectorInfo & { position: number }
    ) =>
      this.updateGeneric<ConnectorInfo & { position: number }>(
        connectorCrud,
        projectId,
        p,
        () => new ConnectorInfo()
      ),
  };

  updateServerHandler: UpdateServerHandler = {
    resource: 'updateServer',
    handler: async (projectId: string, p: ServerInfo & { position: number }) =>
      this.updateGeneric<ServerInfo>(
        serverCrud,
        projectId,
        p,
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
