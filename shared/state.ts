import { Shape } from 'shape';
import * as uuid from 'uuid';
import { VERSION } from './constants';
import { SupportedLanguages } from './languages';
import { getPath, mergeDeep, setPath } from './object';

export class PanelResult {
  exception?: Error;
  value?: Array<any>;
  preview: string;
  stdout: string;
  shape: Shape;
  size: number;
  contentType: string;
  elapsed?: number;

  constructor() {
    this.stdout = '';
    this.shape = { kind: 'unknown' };
    this.preview = '';
    this.size = 0;
    this.contentType = 'unknown';
    this.elapsed = 0;
  }
}

export class PanelResultMeta extends PanelResult {
  lastRun: Date;
  loading: boolean;

  constructor() {
    super();
    this.lastRun = null;
    this.loading = false;
  }

  static fromJSON(raw: any): PanelResultMeta {
    raw = raw || {};
    raw.loading = false;
    const prm = mergeDeep(new PanelResultMeta(), raw);
    prm.lastRun =
      typeof raw.lastRun === 'string'
        ? new Date(raw.lastRun)
        : raw.lastRun || prm.lastRun;
    return prm;
  }
}

export class Encrypt {
  value: string;
  encrypted: boolean;

  constructor(value: string) {
    this.value = value;
    this.encrypted = false;
  }
}

export type ServerInfoType = 'ssh-agent' | 'password' | 'private-key';

export class ServerInfo {
  name: string;
  address: string;
  port: number;
  type: ServerInfoType;
  username: string;
  password: Encrypt;
  privateKeyFile: string;
  passphrase: Encrypt;
  id: string;

  constructor(
    name?: string,
    address?: string,
    port?: number,
    type?: ServerInfoType,
    username?: string,
    password?: Encrypt,
    privateKeyFile?: string,
    passphrase?: Encrypt
  ) {
    this.type = type || 'private-key';
    this.name = name || 'Untitled Server';
    this.address = address || '';
    this.port = port || 22;
    this.username = username || '';
    this.password = password || new Encrypt('');
    this.privateKeyFile = privateKeyFile || '~/.ssh/id_rsa';
    this.passphrase = passphrase || new Encrypt('');
    this.id = uuid.v4();
  }

  static fromJSON(raw: any): ServerInfo {
    raw = raw || {};
    return mergeDeep(new ServerInfo(), raw);
  }
}

export type ConnectorInfoType = 'database' | 'http';

export class ConnectorInfo {
  name: string;
  type: ConnectorInfoType;
  id: string;
  serverId?: string;

  constructor(type?: ConnectorInfoType, name?: string, serverId?: string) {
    this.name = name || 'Untitled Connector';
    this.type = type || 'database';
    this.serverId = serverId;
    this.id = uuid.v4();
  }

  static fromJSON(raw: any): ConnectorInfo {
    raw = raw || {};
    const ci = mergeDeep(new ConnectorInfo(), raw);

    switch (raw.type) {
      case 'database':
        return mergeDeep(new DatabaseConnectorInfo(), ci);
      case 'http':
        return mergeDeep(new HTTPConnectorInfo(), ci);
    }
    return ci;
  }
}

export type HTTPConnectorInfoMethod =
  | 'GET'
  | 'HEAD'
  | 'PUT'
  | 'POST'
  | 'DELETE';

export class ContentTypeInfo {
  type: string;
  customLineRegexp: string;

  constructor(type?: string, customLineRegexp?: string) {
    this.type = type || '';
    this.customLineRegexp = customLineRegexp || '';
  }

  static fromJSON(raw: any): ContentTypeInfo {
    return mergeDeep(new ContentTypeInfo(), raw);
  }
}

export class HTTPConnectorInfo extends ConnectorInfo {
  http: {
    headers: Array<{ value: string; name: string }>;
    url: string;
    method: HTTPConnectorInfoMethod;
    contentTypeInfo: ContentTypeInfo;
  };

  constructor(
    name?: string,
    url?: string,
    headers: Array<{ value: string; name: string }> = [],
    method?: HTTPConnectorInfoMethod,
    contentTypeInfo?: ContentTypeInfo
  ) {
    super('http', name);
    this.http = {
      headers,
      url: url || '',
      method: method || 'GET',
      contentTypeInfo: contentTypeInfo || new ContentTypeInfo(),
    };
  }
}

export type TimeSeriesConnectorInfoType =
  | 'elasticsearch'
  | 'splunk'
  | 'prometheus'
  | 'influx';

export type DatabaseConnectorInfoType =
  | 'postgres'
  | 'mydatabase'
  | 'sqlite'
  | 'oracle'
  | 'databaseserver'
  | 'presto'
  | 'clickhouse'
  | 'snowflake'
  | 'cassandra'
  | TimeSeriesConnectorInfoType;

export class DatabaseConnectorInfo extends ConnectorInfo {
  database: {
    type: DatabaseConnectorInfoType;
    database: string;
    username: string;
    password: Encrypt;
    address: string;

    extra: Record<string, string>;
  };

  constructor(
    name?: string,
    type?: DatabaseConnectorInfoType,
    database?: string,
    username?: string,
    password?: Encrypt,
    address?: string
  ) {
    super('database', name);
    this.database = {
      type: type || 'postgres',
      database: database || '',
      username: username || '',
      password: password || new Encrypt(''),
      address: address || '',
      extra: {},
    };
  }
}

export type PanelInfoType =
  | 'table'
  | 'http'
  | 'graph'
  | 'program'
  | 'literal'
  | 'database'
  | 'file'
  | 'filagg';

export class PanelInfo {
  content: string;
  type: PanelInfoType;
  name: string;
  id: string;
  serverId: string;
  resultMeta: PanelResultMeta;

  constructor(type: PanelInfoType, name?: string, content?: string) {
    this.content = content || '';
    this.type = type;
    this.name = name || '';
    this.id = uuid.v4();
    this.resultMeta = new PanelResultMeta();
  }

  static fromJSON(raw: any): PanelInfo {
    raw = raw || {};
    let pit: PanelInfo = mergeDeep(new PanelInfo(raw.type || 'literal'), raw);

    switch (pit.type) {
      case 'table':
        pit = mergeDeep(new TablePanelInfo(), pit);
      case 'http':
        pit = mergeDeep(new HTTPPanelInfo(), pit);
      case 'graph':
        pit = mergeDeep(new GraphPanelInfo(), pit);
      case 'program':
        pit = mergeDeep(new ProgramPanelInfo(), pit);
      case 'literal':
        pit = mergeDeep(new LiteralPanelInfo(), pit);
      case 'database':
        pit = mergeDeep(new DatabasePanelInfo(), pit);
      case 'file':
        pit = mergeDeep(new FilePanelInfo(), pit);
      case 'filagg':
        pit = mergeDeep(new FilterAggregatePanelInfo(), pit);
    }

    pit.resultMeta = PanelResultMeta.fromJSON(raw.resultMeta);
    return pit;
  }
}

export class ProgramPanelInfo extends PanelInfo {
  program: {
    type: SupportedLanguages;
  };

  constructor(name?: string, type?: SupportedLanguages, content?: string) {
    super('program', name, content);
    this.program = {
      type: type || 'python',
    };
  }
}

export interface GraphY {
  field: string;
  label: string;
}

export type GraphPanelInfoType = 'bar' | 'pie';

export class GraphPanelInfo extends PanelInfo {
  graph: {
    panelSource: number;
    ys: Array<GraphY>;
    x: string;
    type: GraphPanelInfoType;
  };

  constructor(
    name?: string,
    panelSource?: number,
    ys?: Array<GraphY>,
    x?: string,
    type?: GraphPanelInfoType,
    content?: string
  ) {
    super('graph', name, content);
    this.graph = {
      panelSource: panelSource || 0,
      x: x || '',
      ys: ys || [],
      type: type || 'bar',
    };
  }
}

export type TimeSeriesRelativeTimes =
  | 'last-5-minutes'
  | 'last-15-minutes'
  | 'last-30-minutes'
  | 'last-hour'
  | 'last-3-hours'
  | 'last-6-hours'
  | 'last-12-hours'
  | 'last-day'
  | 'last-3-days'
  | 'last-week'
  | 'last-2-weeks'
  | 'last-month'
  | 'last-2-months'
  | 'last-3-months'
  | 'last-6-months'
  | 'last-year'
  | 'last-2-years'
  | 'all-time';

export type TimeSeriesFixedTimes =
  | 'this-hour'
  | 'previous-hour'
  | 'today'
  | 'yesterday'
  | 'week-to-date'
  | 'previous-week'
  | 'month-to-date'
  | 'previous-month'
  | 'quarter-to-date'
  | 'previous-quarter'
  | 'year-to-date'
  | 'previous-year';

export type TimeSeriesRange =
  {
    field: string;
  } &
  ({
      rangeType: 'absolute';
      begin: Date;
      end: Date;
    }
  | {
      rangeType: 'relative';
      relative: TimeSeriesRelativeTimes;
    }
  | {
      rangeType: 'fixed';
      fixed: TimeSeriesFixedTimes;
    });

export class DatabasePanelInfo extends PanelInfo {
  database: {
    type: DatabaseConnectorInfoType;
    connectorId?: string;
  };

  constructor(
    name?: string,
    type?: DatabaseConnectorInfoType,
    connectorId?: string,
    range?: TimeSeriesRange,
    content?: string
  ) {
    super('database', name, content);
    this.database = {
      type: type || 'postgres',
      connectorId,
      range: range || {
        field: '',
        rangeType: 'relative',
        relative: 'last-hour',
      },
    };
  }
}

export type HTTPPanelInfoType = 'csv' | 'json';

export class HTTPPanelInfo extends PanelInfo {
  http: HTTPConnectorInfo;

  constructor(name?: string, http?: HTTPConnectorInfo, content?: string) {
    super('http', name, content);
    this.http = http || new HTTPConnectorInfo();
  }
}

export interface TableColumn {
  label: string;
  field: string;
}

export class TablePanelInfo extends PanelInfo {
  table: {
    columns: Array<TableColumn>;
    panelSource: number;
  };

  constructor(
    name?: string,
    columns: Array<TableColumn> = [],
    panelSource: number = 0,
    content?: string
  ) {
    super('table', name, content);
    this.table = {
      columns,
      panelSource,
    };
  }
}

export type AggregateType =
  | 'none'
  | 'count'
  | 'sum'
  | 'average'
  | 'min'
  | 'max';

export class FilterAggregatePanelInfo extends PanelInfo {
  filagg: {
    panelSource: number;
    filter: string;
    aggregateType: AggregateType;
    groupBy: string;
    aggregateOn: string;
    sortOn: string;
    sortAsc: boolean;
    limit: number;
  };

  constructor(
    name?: string,
    panelSource?: number,
    filter?: string,
    aggregateType?: AggregateType,
    groupBy?: string,
    aggregateOn?: string,
    sortOn?: string,
    sortAsc?: boolean,
    content?: string,
    limit?: number
  ) {
    super('filagg', name, content);
    this.filagg = {
      panelSource: panelSource || 0,
      filter: filter || '',
      aggregateType: aggregateType || 'none',
      groupBy: groupBy || '',
      aggregateOn: aggregateOn || '',
      sortOn: sortOn || '',
      sortAsc: sortAsc || false,
      limit: 100,
    };
  }
}

export class FilePanelInfo extends PanelInfo {
  file: {
    contentTypeInfo: ContentTypeInfo;
    name: string;
    content: ArrayBuffer;
  };

  constructor(
    name?: string,
    fileName?: string,
    fileContent?: ArrayBuffer,
    contentTypeInfo?: ContentTypeInfo
  ) {
    super('file', name, '');
    this.file = {
      name: fileName || '',
      content: fileContent || new ArrayBuffer(0),
      contentTypeInfo: contentTypeInfo || new ContentTypeInfo(),
    };
  }
}

export class LiteralPanelInfo extends PanelInfo {
  literal: {
    contentTypeInfo: ContentTypeInfo;
  };

  constructor(
    name?: string,
    content?: string,
    contentTypeInfo?: ContentTypeInfo
  ) {
    super('literal', name, content);
    this.literal = {
      contentTypeInfo: contentTypeInfo || new ContentTypeInfo(),
    };
  }
}

export class ProjectPage {
  panels: Array<PanelInfo>;
  name: string;
  id: string;

  constructor(name?: string, panels?: Array<PanelInfo>) {
    this.name = name || '';
    this.panels = panels || [];
    this.id = uuid.v4();
  }

  static fromJSON(raw: any): ProjectPage {
    raw = raw || {};
    const pp = new ProjectPage();
    pp.panels = (raw.panels || []).map(PanelInfo.fromJSON);
    pp.name = raw.name;
    pp.id = raw.id || uuid.v4();
    return pp;
  }
}

export async function doOnAllInstanceFields<T>(
  s: ProjectState,
  guard: (a: any) => a is T,
  cb: (field: T, path: string) => Promise<T>
) {
  // Only trust prototype on a real object.
  const referenceObject = new ProjectState();
  const stack: Array<[any, Array<string>]> = [[referenceObject, []]];

  while (stack.length) {
    const [top, path] = stack.pop();

    if (top && typeof top === 'object') {
      for (const [elPath, el] of Object.entries(top)) {
        stack.push([el, [...path, elPath]]);
      }
    }

    const realTop = getPath(s, path.join('.'));
    if (guard(realTop)) {
      setPath(s, path.join('.'), await cb(realTop, path.join('.')));
    }
  }
}

export function doOnAllEncryptFields(
  s: ProjectState,
  cb: (field: Encrypt, path: string) => Promise<Encrypt>
) {
  return doOnAllInstanceFields<Encrypt>(
    s,
    (field: any): field is Encrypt => field instanceof Encrypt,
    cb
  );
}

export function doOnAllDateFields(
  s: ProjectState,
  cb: (field: Date) => Promise<Date>
) {
  return doOnAllInstanceFields<Date>(
    s,
    (field: any): field is Date => field instanceof Date,
    (d: Date) => {
      const nd = new Date(d);
      if (String(nd) === 'Invalid Date') {
        return Promise.resolve(new Date());
      }

      return Promise.resolve(nd);
    }
  );
}

export class ProjectState {
  pages: Array<ProjectPage>;
  projectName: string;
  connectors: Array<ConnectorInfo>;
  servers: Array<ServerInfo>;
  id: string;
  originalVersion: string;
  lastVersion: string;

  constructor(
    projectName?: string,
    pages?: Array<ProjectPage>,
    connectors?: Array<ConnectorInfo>,
    servers?: Array<ServerInfo>,
    originalVersion?: string,
    lastVersion?: string
  ) {
    this.pages = pages || [];
    this.projectName = projectName || '';
    this.connectors = connectors || [];
    this.servers = servers || [];
    this.originalVersion = originalVersion || VERSION;
    this.lastVersion = lastVersion || VERSION;
    this.id = uuid.v4();
  }

  static fromJSON(raw: any): ProjectState {
    raw = raw || {};
    const ps = new ProjectState();
    ps.projectName = raw.projectName || '';
    ps.pages = (raw.pages || []).map(ProjectPage.fromJSON);
    ps.connectors = (raw.connectors || []).map(ConnectorInfo.fromJSON);
    ps.servers = (raw.servers || []).map(ServerInfo.fromJSON);
    ps.id = raw.id || uuid.v4();
    ps.originalVersion = raw.originalVersion || VERSION;
    ps.lastVersion = raw.lastVersion || VERSION;
    doOnAllEncryptFields(ps, (f) => {
      const new_ = new Encrypt(null);
      new_.encrypted = true;
      return Promise.resolve(new_);
    });
    return ps;
  }
}

export const DEFAULT_PROJECT: ProjectState = new ProjectState(
  'Example project',
  [
    new ProjectPage('CSV Discovery Example', [
      new LiteralPanelInfo(
        'Raw CSV Text',
        'name,age\nMorgan,12\nJames,17',
        new ContentTypeInfo('text/csv')
      ),
      new ProgramPanelInfo(
        'Transform with SQL',
        'sql',
        'SELECT name, age+5 AS age FROM DM_getPanel(0);'
      ),
      (() => {
        const panel = new GraphPanelInfo('Display');
        panel.graph.ys = [{ field: 'age', label: 'Age' }];
        panel.graph.x = 'name';
        panel.graph.panelSource = 1;
        return panel;
      })(),
    ]),
  ]
);
