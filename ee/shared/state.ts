// Copyright 2022 Multiprocess Labs LLC

import { mergeDeep, newId } from '../../shared/object';

export class History {
  id: string;
  table: string;
  pk: string;
  dt: Date;
  oldValue: any;
  newValue: any;
  action: 'update' | 'insert' | 'delete';
  error: string;
  userId: string;

  constructor(defaults: Partial<History> = {}) {
    this.id = defaults.id || newId();
    this.table = defaults.table || '';
    this.pk = defaults.pk || '';
    this.dt = defaults.dt || new Date();
    this.oldValue = defaults.oldValue || null;
    this.newValue = defaults.newValue || null;
    this.error = defaults.error || '';
    this.userId = defaults.userId || '';
    this.action = defaults.action || 'update';
  }

  static fromJSON(raw: any): History {
    raw = raw || {};

    const his = mergeDeep(new History(), raw);
    if (typeof raw.dt === 'number') {
      raw.dt *= 1000;
    }
    his.dt =
      (['string', 'number'].includes(typeof raw.dt)
        ? new Date(raw.dt)
        : raw.dt) || his.dt;
    return his;
  }
}
