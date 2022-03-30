// Copyright 2022 Multiprocess Labs LLC

import fs from 'fs';
import path from 'path';
import * as rpc_ce from '../../desktop/rpc';
import * as store_ce from '../../desktop/store';
import { deepClone } from '../../shared/object';
import { doOnMatchingFields } from '../../shared/state';
import { History } from '../shared/state';
import { GetHistoryHandler } from './rpc';

function unix(dt: Date) {
  return Math.floor(dt.getTime() / 1000);
}

export function getMigrations() {
  const migrationsBase = path.join(__dirname, 'migrations');
  const migrations = fs
    .readdirSync(migrationsBase)
    .filter((f) => f.endsWith('.sql'))
    .map((file) => path.join(migrationsBase, file));
  migrations.sort();
  return migrations;
}

export class Store extends store_ce.Store {
  constructor() {
    const migrations = store_ce.getMigrations();
    for (const f of getMigrations()) {
      if (!migrations.includes(f)) {
        migrations.push(f);
      }
    }

    super(undefined, migrations);
  }
  getAuditableValue(value: any) {
    const copy = deepClone(value);
    // Blank out all encrypted fields, all temporal-changing fields.
    doOnMatchingFields(
      copy,
      (f) => f.endsWith('_encrypt') || f.endsWith('lastEdited'),
      () => undefined
    );
    return JSON.stringify(copy);
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

      const auditableOld = this.getAuditableValue(data.oldValue);
      const auditableNew = this.getAuditableValue(data.newValue);

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
        'action',
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
        data.action,
      ];
      db.transaction(() => {
        // Grab the last value
        const row = db
          .prepare(
            `SELECT action, new_value AS val FROM ds_history WHERE tbl = ? AND pk = ? ORDER BY dt DESC LIMIT 1`
          )
          .get(data.table, data.pk);
        // Don't log the same value twice
        if (row && row.val === auditableNew && row.action === data.action) {
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

  // Only used in tests
  getHandlers(): rpc_ce.RPCHandler<any, any, any>[] {
    return [...super.getHandlers(), this.getHistoryHandler];
  }
}
