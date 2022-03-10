import fs from 'fs';
import path from 'path';
import log from '../shared/log';
import { getPath } from '../shared/object';
import { GetProjectRequest, MakeProjectRequest } from '../shared/rpc';
import { doOnEncryptFields, Encrypt, ProjectState } from '../shared/state';
import { DISK_ROOT, PROJECT_EXTENSION, SYNC_PERIOD } from './constants';
import { ensureFile } from './fs';
import {
  GetProjectHandler,
  MakeProjectHandler,
  RPCHandler,
  UpdateProjectHandler,
} from './rpc';
import { serverCrud, pageCrud, panelCrud, connectorCrud, metadataCrud } from './crud';
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

export function encryptProjectSecrets(
  s: any,
  existingState: any
) {
  return doOnEncryptFields(s, (field: Encrypt, path: string) => {
    return checkAndEncrypt(field, getPath(existingState, path));
  });
}
export class Store() {
  connections: Record<string, sqlite.Database> = {};

  async getConnection(projectId: string) Promise<sqlite.Database> {
    if (this.connections[projectId]) {
      return this.connections[projectId];
    }

    const fileName = ensureProjectFile(projectId);
    return this.connections[projectId] = await db.open(fileName);
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
      const [rawProject, servers, pages, panels, connectors] = await Promise.all([
        metadataCrud.get(db),
        serverCrud.get(db),
        pageCrud.get(db),
        panelCrud.get(db),
        connectorCrud.get(db),
      ]);
      rawProject.servers = servers;

      page.panels = [];
      for (const page of pages) {
        for (const panel of panels) {
          if (page.id === panel.pageId) {
            page.panels.push(panel);
          }
        }

        page.panels.sort((a, b) => a.order - b.order);
      }
      rawProject.pages = pages;

      return ProjectState.fromJSON(rawProject, external);
    },
  };

  makeProjectHandler: MakeProjectHandler = {
    resource: 'makeProject',
    handler: async (_: string, { projectId }: MakeProjectRequest) => {
      const db = await this.getConnection(projectId);
      const newProject = new ProjectState();
      newProject.projectName = fileName;
      const files = fs.readdirSync(path.join(__dirname, 'migrations'));
      files.sort();
      for (const file of files) {
        log.info('Running migration: ' + file);
        const contents = fs.readFileSync(file).toString();
        await db.exec(contents);
        log.info('Done migration: ' + file);
      }

      await metadataCrud.update(newProject);
    },
  };

  updatePanelHandler: UpdatePanelHandler = {
    resource: 'updatePanel',
    handler: async (projectId: string, p: PanelInfo) => {
      const db = await this.getConnection(projectId);
      await db.run('BEGIN');
      try {
        try {
          const existing = await panelCrud.getOne(p.id);
        } catch (e) {
          console.log(e);
        }

        encryptProjectSecrets(p, existing);
        await panelCrud.update(p);

        await db.run('COMMIT');
      } catch (e) {
        await db.run('ROLLBACK');
      }
    },
  };

  updateConnectorHandler: UpdateConnectorHandler = {
    resource: 'updateConnector',
    handler: async (projectId: string, p: ConnectorInfo) => {
      const db = await this.getConnection(projectId);
      await db.run('BEGIN');
      try {
        try {
          const existing = await connectorCrud.getOne(p.id);
        } catch (e) {
          console.log(e);
        }

        encryptProjectSecrets(p, existing);
        await connectorCrud.update(p);

        await db.run('COMMIT');
      } catch (e) {
        await db.run('ROLLBACK');
      }
    },
  };

  updateServerHandler: UpdateServerHandler = {
    resource: 'updateServer',
    handler: async (projectId: string, p: ServerInfo) => {
      const db = await this.getConnection(projectId);
      await db.run('BEGIN');
      try {
        try {
          const existing = await serverCrud.getOne(p.id);
        } catch (e) {
          console.log(e);
        }

        encryptProjectSecrets(p, existing);
        await serverCrud.update(p);

        await db.run('COMMIT');
      } catch (e) {
        await db.run('ROLLBACK');
      }
    },
  };

  // Break handlers out so they can be individually typed without `any`,
  // only brought here and masked as `any`.
  getStoreHandlers(): RPCHandler<any, any>[] {
    return [
      getProjectHandler,
      updateProjectHandler,
      makeProjectHandler,
    ];
  }
}

export function ensureProjectFile(projectId: string) {
  const ext = '.' + PROJECT_EXTENSION;
  return ensureFile(projectId + (projectId.endsWith(ext) ? '' : ext));
}
