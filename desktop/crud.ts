import * as sqlite3 from 'better-sqlite3';
import {
  ConnectorInfo,
  Dashboard,
  DashboardPanel,
  Destination,
  Export,
  PanelInfo,
  ProjectPage,
  ServerInfo,
} from '../shared/state';

export type EntityType =
  | 'ds_server'
  | 'ds_connector'
  | 'ds_page'
  | 'ds_panel'
  | 'ds_dashboard'
  | 'ds_dashboard_panel'
  | 'ds_export'
  | 'ds_destination';

export class GenericCrud<T extends { id: string }> {
  entity: string;
  stubMaker: () => () => string;
  constructor(entity: EntityType, stubMaker = () => () => '?') {
    this.entity = entity;
    this.stubMaker = stubMaker;
  }

  get(
    db: sqlite3.Database,
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

    const stmt = db.prepare(
      `SELECT * FROM "${this.entity}"${extra} ORDER BY position ASC`
    );
    const rows = stmt.all(values);
    const mapped: Array<T> = rows.map(function mapObject({
      data_json,
    }: {
      data_json: string;
    }) {
      return JSON.parse(data_json) as T;
    });
    return mapped;
  }

  getOne(db: sqlite3.Database, id: string): [T, number] {
    const stubMaker = this.stubMaker();
    const stmt = db.prepare(
      `SELECT data_json, position FROM "${
        this.entity
      }" WHERE id = ${stubMaker()}`
    );
    const row = stmt.get(id) as { data_json: string; position: number };
    if (!row) {
      return [null, -1];
    }

    return [JSON.parse(row.data_json), row.position];
  }

  del(db: sqlite3.Database, id: string) {
    const stubMaker = this.stubMaker();
    const stmt = db.prepare(
      `DELETE FROM "${this.entity}" WHERE id = ${stubMaker()}`
    );
    stmt.run(id);
  }

  insert(
    db: sqlite3.Database,
    obj: T,
    position: number,
    foreignKey?: { column: string; value: string }
  ) {
    const j = JSON.stringify(obj);
    const stubMaker = this.stubMaker();
    const columns = ['id', 'position', 'data_json'];
    const stubs = [stubMaker(), stubMaker(), stubMaker()];
    const values = [obj.id, position, j];
    if (foreignKey) {
      columns.push(foreignKey.column);
      values.push(foreignKey.value);
      stubs.push(stubMaker());
    }
    const stmt = db.prepare(
      `INSERT INTO "${this.entity}" (${columns.join(
        ', '
      )}) VALUES (${stubs.join(', ')})`
    );
    stmt.run(values);
  }

  update(db: sqlite3.Database, obj: T) {
    const j = JSON.stringify(obj);
    const stubMaker = this.stubMaker();
    const stmt = db.prepare(
      `UPDATE ${
        this.entity
      } SET data_json = ${stubMaker()} WHERE id = ${stubMaker()}`
    );
    stmt.run(j, obj.id);
  }
}

export const serverCrud = new GenericCrud<ServerInfo>('ds_server');
export const pageCrud = new GenericCrud<ProjectPage>('ds_page');
export const connectorCrud = new GenericCrud<ConnectorInfo>('ds_connector');
export const panelCrud = new GenericCrud<PanelInfo>('ds_panel');
export const dashboardCrud = new GenericCrud<Dashboard>('ds_dashboard');
export const dashboardPanelCrud = new GenericCrud<DashboardPanel>(
  'ds_dashboard_panel'
);
export const exportCrud = new GenericCrud<Export>('ds_export');
export const destinationCrud = new GenericCrud<Destination>('ds_destination');

export const exportDestination = {};

export const metadataCrud = {
  get(db: sqlite3.Database) {
    const stmt = db.prepare('SELECT * FROM ds_metadata');
    const rows = stmt.all() as Array<{ key: string; value: string }>;
    const metadata: Record<string, string> = {};
    for (const row of rows) {
      metadata[row.key] = row.value;
    }

    return metadata;
  },

  insert(db: sqlite3.Database, metadata: Record<string, string>) {
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO ds_metadata (key, value) VALUES (?, ?)'
    );
    for (const kv of Object.entries(metadata)) {
      stmt.run(kv);
    }
  },
};
