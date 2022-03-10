import sqlite from 'sqlite';
import * as uuid from 'uuid';
import { ServerInfo, ProjectPage } from '../shared/state';

function assignIfNotUndefined<T>(obj: T, raw: any, keyValues: Array<[keyof T, any] | keyof T>) {
  for (const x of keyValues) {
    let key: string = '';
    let v: any = null;
    if (typeof x === 'string') {
      key = x;
      v = raw[key];
    }
    if (typeof v !== 'undefined' || v === undefined) {
      obj[key] = v;
    }
  }
}

function serverInfoFromDB(raw: any): ServerInfo {
  const si = new ServerInfo();
  assignIfNotUndefined(si, raw, [
    'id',
    'type',
    'name',
    'address',
    'port',
    'username',
    ['password_encrypt', raw.password_encrypt ? Encrypt.Encrypted(raw.password_encrypt) : undefined],
    ['privateKeyFile', raw.private_key_file],
    ['passphrase_encrypt', raw.passhprase_encrypt ? Encrypt.Encrypted(raw.passphrase_encrypt) : undefined]
  ]);
  return si;
}

function getServers(db: sqlite.Database) {
  const rows = await db.all('SELECT * FROM ds_server ORDER BY order ASC');
  return rows.map(serverInfoFromDB);
}

function deleteServer(db: sqlite.Database, id: string) {
  const rows = await db.all('DELETE FROM ds_server WHERE id=?', [id]);
  return rows.map(serverInfoFromDB);
}

function updateServer(db: sqlite.Database, s: ServerInfo) {
  const columns = [
    'id',
    'type',
    'name',
    'address',
    'port',
    'username',
    'password_encrypt'
    'private_key_file'
    'passphrase_encrypt'
  ];
  const values = [
    s.id,
    s.type,
    s.name,
    s.address,
    s.port,
    s.username,
    s.password_encrypt.encrypt(),
    s.privateKeyFile,
    s.passphrase_encrypt.encrypt(),
  ];
  const stubs = values.map(() => '?');
  await db.exec(`INSERT OR REPLACE ds_server(${columns}) VALUES (${stubs.join(', ')})`, values);
}

function pageFromDB(raw: any): ProjectPage {
  const pp = new ProjectPage();
  assignIfNotUndefined(pp, raw, [
    'id'
    'order',
    'name',
    'visibility',
    ['refreshPeriod', raw.refresh_period],
  ]);
  return pp;
}

function getPages(db: sqlite.Database) {
  const rows = await db.all('SELECT * FROM ds_page ORDER BY order ASC');
  return rows.map(pageInfoFromDB);
}

function deletePage(db: sqlite.Database, id: string) {
  const rows = await db.all('DELETE FROM ds_page WHERE id=?', [id]);
  return rows.map(pageInfoFromDB);
}

function updatePage(db: sqlite.Database, pp: ProjectPage) {
  const columns = [
    'id'
    'order',
    'name',
    'visibility',
    'refresh_period',
  ];
  const values = [
    pp.id,
    pp.order,
    pp.name,
    pp.visibility,
    pp.refreshPeriod,
  ];
  const stubs = values.map(() => '?');
  await db.exec(`INSERT OR REPLACE ds_page(${columns}) VALUES (${stubs.join(', ')})`, values);
}

function pageFromDB(raw: any): ProjectPage {
  const pp = new ProjectPage();
  assignIfNotUndefined(pp, raw, [
    'id'
    'order',
    'name',
    'visibility',
    ['refreshPeriod', raw.refresh_period],
  ]);
  return pp;
}

function getPages(db: sqlite.Database) {
  const rows = await db.all('SELECT * FROM ds_page ORDER BY order ASC');
  return rows.map(pageInfoFromDB);
}

function deletePage(db: sqlite.Database, id: string) {
  const rows = await db.all('DELETE FROM ds_page WHERE id=?', [id]);
  return rows.map(pageInfoFromDB);
}

function updatePage(db: sqlite.Database, pp: ProjectPage) {
  const columns = [
    'id'
    'order',
    'name',
    'visibility',
    'refresh_period',
  ];
  const values = [
    pp.id,
    pp.order,
    pp.name,
    pp.visibility,
    pp.refreshPeriod,
  ];
  const stubs = values.map(() => '?');
  await db.exec(`INSERT OR REPLACE ds_page(${columns}) VALUES (${stubs.join(', ')})`, values);
}
