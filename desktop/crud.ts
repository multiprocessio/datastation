import sqlite from 'sqlite';
import { ServerInfo, ProjectPage, PanelInfo, ConnectorInfo } from '../shared/state';

function makeGenericCrud<T extends { id: string, order: number }>(entity: string) {
  async function get(db: sqlite.Database) {
    const rows = await db.all('SELECT * FROM ' + entity);
    const mapped = rows.map(function mapObject({ data_json }: { data_json: string }) {
      return JSON.parse(data_json) as T;
    });
    mapped.sort((a, b) => a.order - b.order);
    return mapped;  
  }

  async function getOne(db: sqlite.Database, id: string) {
    const row = await db.get(`SELECT * FROM ${entity} WHERE id = ?`, [id]);
    return JSON.parse(row);
  }

  async function del(db: sqlite.Database, id: string) {
    await db.exec('DELETE FROM ${entity} WHERE id=?', [id]);
  }

  async function update(db: sqlite.Database, obj: T) {
    const j = JSON.stringify(obj);
    await db.exec(`INSERT OR REPLACE ${entity}(id, json_data) VALUES (?, ?)`, [obj.id, j]);
  }

  return {
    get,
    getOne,
    update,
    del,
  };
}

export const serverCrud = makeGenericCrud<ServerInfo>('ds_server');
export const pageCrud = makeGenericCrud<ProjectPage>('ds_page');
export const connectorCrud = makeGenericCrud<ConnectorInfo>('ds_connector');
export const panelCrud = makeGenericCrud<PanelInfo>('ds_panel');

export const metadataCrud = {
  async get(db: sqlite.Database) {
    const rows = await db.all('SELECT * FROM ds_metadata');
    const metadata: Record<string, string> = {};
    for (const row of rows) {
      metadata[row.key] = row.value;
    }

    return metadata;
  },

  async update(db: sqlite.Database, metadata: Record<string, string>) {
    const stmt = await db.prepare('INSERT OR REPLACE ds_metadata (key, value) VALUES (?, ?)');
    for (const kv of Object.entries(metadata)) {
      await stmt.bind(kv);
    }

    await stmt.run();
  }
}
