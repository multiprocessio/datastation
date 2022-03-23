// Copyright 2022 Multiprocess Labs LLC

import * as store_ce from '../../desktop/store';
import { deepClone, setPath } from '../../shared/object';
import { doOnMatchingFields } from '../../shared/state';
import { History } from '../shared/state';
import { GetHistoryHandler } from './rpc';

function unix(dt: Date) {
  return Math.floor(dt.getTime() / 1000);
}

export class Store extends store_ce.Store {
  async getAuditableValue(value: any) {
    const copy = deepClone(value);
    // Blank out all encrypted fields, all temporal-changing fields.
    await doOnMatchingFields(
      copy,
      (f) => {
        console.log(f);
        return f.endsWith('_encrypt') || f.endsWith('lastEdited');
      },
      (_: any, p: string) => setPath(copy, p, undefined)
    );
    return copy;
  }

  insertHistoryHandler = {
    resource: 'insertHistory',
    handler: async (
      projectId: string,
      {
        data,
      }: {
        data: History;
      },
      _: unknown,
      external: boolean
    ) => {
      this.guardInternalOnly(external);

      const auditableOld = await this.getAuditableValue(data.oldValue);
      const auditableNew = await this.getAuditableValue(data.newValue);

      const db = this.getConnection(projectId);
      const columns = [
        'id',
        'tbl',
        'pk',
        'dt',
        'error',
        'old_value',
        'new_value',
        'user_id',
      ];
      const stubMaker = this.stubMaker();
      const stubs = columns.map(() => stubMaker());
      const values = [
        data.id,
        data.table,
        data.pk,
        unix(data.dt),
        data.error,
        auditableOld,
        auditableNew,
        data.userId,
      ];
      db.transaction(() => {
        // Grab the last value
        const row = db
          .prepare(
            `SELECT new_value AS val FROM ds_history WHERE tbl = ? AND pk = ? ORDER BY dt DESC LIMIT 1`
          )
          .get(data.table, data.pk);
        // Don't log the same value twice
        if (row && row.val === auditableNew) {
          return;
        }

        const stmt = db.prepare(
          `INSERT INTO ds_history (${columns.join(', ')}) VALUES(${stubs.join(
            ', '
          )})`
        );
        stmt.run(values);
      })();
    },
  };

  getHistoryHandler: GetHistoryHandler = {
    resource: 'getHistory',
    handler: async (
      projectId: string,
      body: {
        lastId?: string;
      },
      _: unknown,
      external: boolean
    ) => {
      const stubMaker = this.stubMaker();
      const maybeWhere = body.lastId
        ? `WHERE dt < (SELECT dt FROM ds_history WHERE id = ${stubMaker()}) `
        : '';
      const db = this.getConnection(projectId);
      const stmt = db.prepare(
        `SELECT * FROM ds_history ${maybeWhere}ORDER BY dt DESC LIMIT 100`
      );
      const rows: Array<any> = body.lastId ? stmt.all(body.lastId) : stmt.all();
      const history = rows.map(
        (r) =>
          new History({
            ...r,
            table: r.tbl,
            oldValue: r.old_value,
            newValue: r.new_value,
          })
      );

      return { history };
    },
  };
}
