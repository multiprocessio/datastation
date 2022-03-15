import SQLiteDatabase from 'better-sqlite3';
import {
  ConnectorInfo,
  PanelInfo,
  ProjectPage,
  ServerInfo,
} from '../shared/state';

export type EntityType = 'ds_server' | 'ds_connector' | 'ds_page' | 'ds_panel';

export class GenericCrud<T extends { id: string }> {
  entity: string;
  stubMaker: () => () => string;
  constructor(entity: EntityType, stubMaker = () => () => '?') {
    this.entity = entity;
    this.stubMaker = stubMaker;
  }

   get(
    db: SQLiteDatabase,
    extraFilter?: {
      q: string;
      args: Array<any>;
    }
  ) {
    const values = [];
    const extra = extraFilter ? ' WHERE ' + extraFilter.q : '';
    if (extra) {
      values.push(...extraFilter.args);
    }
    const rows =  db.all(
      `SELECT * FROM "${this.entity}"${extra} ORDER BY position ASC`,
      ...values
    );
    const mapped: Array<T> = rows.map(function mapObject({
      data_json,
    }: {
      data_json: string;
    }) {
      return JSON.parse(data_json) as T;
    });
    return mapped;
  }

   getOne(db: SQLiteDatabase, id: string): [T, number] {
    const stubMaker = this.stubMaker();
    const row =  db.get(
      `SELECT data_json, position FROM "${
        this.entity
      }" WHERE id = ${stubMaker()}`,
      id
    );
    if (!row) {
      return [null, -1];
    }

    return [JSON.parse(row.data_json), row.position];
  }

   del(db: SQLiteDatabase, id: string) {
    const stubMaker = this.stubMaker();
     db.run(`DELETE FROM "${this.entity}" WHERE id = ${stubMaker()}`, id);
  }

   insert(db: SQLiteDatabase, obj: T, position: number) {
    const j = JSON.stringify(obj);
    const stubMaker = this.stubMaker();
    const stubs = [stubMaker(), stubMaker(), stubMaker()].join(', ');
     db.run(
      `INSERT INTO "${this.entity}" (id, position, data_json) VALUES (${stubs})`,
      obj.id,
      position,
      j
    );
  }

   update(db: SQLiteDatabase, obj: T) {
    const j = JSON.stringify(obj);
    const stubMaker = this.stubMaker();
     db.run(
      `UPDATE ${
        this.entity
      } SET data_json = ${stubMaker()} WHERE id = ${stubMaker()}`,
      j,
      obj.id
    );
  }
}

export const serverCrud = new GenericCrud<ServerInfo>('ds_server');
export const pageCrud = new GenericCrud<ProjectPage>('ds_page');
export const connectorCrud = new GenericCrud<ConnectorInfo>('ds_connector');
export const panelCrud = new GenericCrud<PanelInfo>('ds_panel');

export const metadataCrud = {
   get(db: SQLiteDatabase) {
    const rows =  db.all('SELECT * FROM ds_metadata');
    const metadata: Record<string, string> = {};
    for (const row of rows) {
      metadata[row.key] = row.value;
    }

    return metadata;
  },

   insert(db: SQLiteDatabase, metadata: Record<string, string>) {
    const stmt =  db.prepare(
      'INSERT INTO ds_metadata (key, value) VALUES (?, ?)'
    );
    for (const kv of Object.entries(metadata)) {
       stmt.bind(kv);
       stmt.run();
    }
  },
};
