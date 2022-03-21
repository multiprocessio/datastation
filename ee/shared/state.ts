import * as uuid from 'uuid';
import { mergeDeep } from '../../shared/object';

export class History {
  id: string;
  table: string;
  pk: string;
  dt: Date;
  oldValue: any;
  newValue: any;
  error: string;

  constructor(defaults: Partial<History> = {}) {
    this.id = uuid.v4();
    this.table = defaults.table || '';
    this.pk = defaults.pk || '';
    this.dt = defaults.dt || new Date();
    this.oldValue = defaults.oldValue || null;
    this.newValue = defaults.newValue || null;
    this.error = defaults.error || '';
  }

  static fromJSON(raw: any): History {
    raw = raw || {};

    const his = mergeDeep(new History(), raw);
    his.dt = (typeof raw.dt === 'string' ? new Date(raw.dt) : raw.dt) || his.dt;
    return his;
  }
}
