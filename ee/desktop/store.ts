// Copyright 2022 Multiprocess Labs LLC

import * as store_ce from '../../desktop/store';
import { InternalEndpoint, Endpoint } from './rpc';
import { History } from '../shared/state';

function unix(dt: Date) {
  return Math.floor(dt.getTime() / 1000);
}

export class Store extends store_ce.Store {
  insertHistoryHandler = {
    resource: 'insertHistory' as InternalEndpoint,
    handler: async (
      projectId: string,
      body: {
        data: History;
      },
      _: unknown,
      external: boolean
    ) => {
      this.guardInternalOnly(external);

      const db = this.getConnection(projectId);
      const columns = [id, table, pk, dt, error, old_value, new_value];
      const stubMaker = this.stubMaker();
      const stubs = columns.map(() => stubMaker());
      const values = [data.id, data.table, data.pk, unix(data.dt), data.error, data.oldValue, data.newValue];
      const stmt = db.prepare(`INSERT INTO ds_history (${columns.join(', ')}) VALUES(${stubs.join(', ')})`);
      stmt.run(values);
    },
  }

  getHistoryHandler = {
    resource: 'getHistory' as InternalEndpoint,
    handler: async (
      projectId: string,
      body: {
        lastId?: string;
      },
      _: unknown,
      external: boolean
    ) => {
      const stubMaker = this.stubMaker();
      const maybeWhere = lastId ? `WHERE dt < (SELECT dt FROM ds_history WHERE id = ${stubMaker()}) ` : '';
      const stmt = db.prepare(`SELECT * FROM ds_history ${maybeWhere}ORDER BY dt DESC LIMIT 100`);
      const rows = lastId ? stmt.all(lastId) : stmt.all();
      return rows.map(r =>
	new History({
	  ...r,
	  oldValue: r.old_value,
	  newValue: r.new_value,
	}));
    },
  }
}
