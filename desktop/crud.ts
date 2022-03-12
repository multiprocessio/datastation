import sqlite from 'sqlite';
import {
  ConnectorInfo,
  PanelInfo,
  ProjectPage,
  ServerInfo,
} from '../shared/state';

export class GenericCrud<T extends { id: string }> {
  entity: string;
  stubMaker: () => () => string;
  constructor(entity: string, stubMaker = () => () => '?') {
    this.entity = entity;
    this.stubMaker = stubMaker;
  }

  async get(
    db: sqlite.Database,
    extraFilter?: {
      q: string;
      args: Array<any>;
    }
  ) {
    const values = [];
    const extra = extraFilter ? ' ' + extraFilter.q : '';
    if (extra) {
      values.push(...extraFilter.args);
    }
    const rows = await db.all(
      'SELECT * FROM ' + this.entity + extra + ' ORDER BY position ASC',
      values
    );
    const mapped: Array<T> = rows.map(function mapObject({
      json_data,
    }: {
      json_data: string;
    }) {
      return JSON.parse(json_data) as T;
    });
    return mapped;
  }

  async getOne(db: sqlite.Database, id: string) {
    const stubMaker = this.stubMaker();
    const row = await db.get(
      `SELECT * FROM ${this.entity} WHERE id = ${stubMaker()}`,
      [id]
    );
    return JSON.parse(row);
  }

  async del(db: sqlite.Database, id: string) {
    const stubMaker = this.stubMaker();
    await db.exec(`DELETE FROM ${this.entity} WHERE id = ${stubMaker()}`, [id]);
  }

  async insert(db: sqlite.Database, obj: T, position: number) {
    const j = JSON.stringify(obj);
    const stubMaker = this.stubMaker();
    const stubs = [stubMaker(), stubMaker(), stubMaker()].join(', ');
    await db.exec(
      `INSERT INTO ${this.entity} (id, position, json_data) VALUES (${stubs})`,
      [obj.id, position, j]
    );
  }

  async update(db: sqlite.Database, obj: T) {
    const j = JSON.stringify(obj);
    const stubMaker = this.stubMaker();
    await db.exec(
      `UPDATE ${
        this.entity
      } SET json_data = ${stubMaker()} WHERE id = ${stubMaker()}`,
      [j, obj.id]
    );
  }
}

export const serverCrud = new GenericCrud<ServerInfo>('ds_server');
export const pageCrud = new GenericCrud<ProjectPage>('ds_page');
export const connectorCrud = new GenericCrud<ConnectorInfo>('ds_connector');
export const panelCrud = new GenericCrud<PanelInfo>('ds_panel');

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
    const stmt = await db.prepare(
      'INSERT OR REPLACE INTO ds_metadata (key, value) VALUES (?, ?)'
    );
    for (const kv of Object.entries(metadata)) {
      await stmt.bind(kv);
    }

    await stmt.run();
  },
};
