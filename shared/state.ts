import { Shape } from 'shape';
import * as uuid from 'uuid';
import { VERSION } from './constants';
import { SupportedLanguages } from './languages';
import { mergeDeep, setPath } from './object';

export class PanelResult {
  exception?: any;
  value?: Array<any>;
  preview: string;
  stdout: string;
  shape: Shape;
  arrayCount: null | number;
  size: number;
  contentType: string;
  elapsed?: number;
  lastRun?: Date;
  loading: boolean;

  constructor(defaults: Partial<PanelResult> = {}) {
    this.lastRun = defaults.lastRun || null;
    this.loading = defaults.loading || false;
    this.stdout = defaults.stdout || '';
    this.shape = defaults.shape || { kind: 'unknown' };
    this.preview = defaults.preview || '';
    this.size = defaults.size || 0;
    this.contentType = defaults.contentType || 'unknown';
    this.elapsed = defaults.elapsed || 0;
    this.value = defaults.value || undefined;
    this.exception = defaults.exception || undefined;
  }

  static fromJSON(raw: any): PanelResult {
    raw = raw || {};
    raw.loading = false;
    const prm = mergeDeep(new PanelResult(), raw);
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

  constructor(value: string = '') {
    this.value = value;
    this.encrypted = false;
  }

  static Encrypted(value: string = '') {
    const e = new Encrypt(value);
    e.encrypted = true;
    return e;
  }
}

export type ServerInfoType = 'ssh-agent' | 'password' | 'private-key';

export class ServerInfo {
  name: string;
  address: string;
  port: number;
  type: ServerInfoType;
  username: string;
  password_encrypt: Encrypt;
  privateKeyFile: string;
  passphrase_encrypt: Encrypt;
  id: string;

  constructor(panel: Partial<ServerInfo> = {}) {
    this.type = panel.type || 'private-key';
    this.name = panel.name || 'Untitled Server';
    this.address = panel.address || '';
    this.port = panel.port || 22;
    this.username = panel.username || '';
    this.password_encrypt = panel.password_encrypt || new Encrypt('');
    this.privateKeyFile = panel.privateKeyFile || '';
    this.passphrase_encrypt = panel.passphrase_encrypt || new Encrypt('');
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
    this.name = name || 'Untitled Data Source';
    this.type = type || 'database';
    this.serverId = serverId;
    this.id = uuid.v4();
  }

  static fromJSON(raw: any): ConnectorInfo {
    raw = raw || {};
    // Migrate panel name from sql to database
    if (raw.type === 'sql') {
      raw.type = 'database';
      raw.database = raw.sql;
      delete raw.sql;
    }
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

export type SQLConnectorType =
  | 'postgres'
  | 'mysql'
  | 'sqlite'
  | 'oracle'
  | 'sqlserver'
  | 'presto'
  | 'clickhouse'
  | 'snowflake'
  | 'cockroach'
  | 'timescale'
  | 'crate'
  | 'yugabyte'
  | 'quest'
  | 'bigquery'
  | 'cassandra'
  | 'scylla'
  | 'athena';

export type DatabaseConnectorInfoType =
  | SQLConnectorType
  | 'google-sheets'
  | 'airtable'
  | 'mongo'
  | 'elasticsearch'
  | 'splunk'
  | 'prometheus'
  | 'influx'
  | 'influx-flux';

export class DatabaseConnectorInfo extends ConnectorInfo {
  database: {
    type: DatabaseConnectorInfoType;
    database: string;
    username: string;
    password_encrypt: Encrypt;
    address: string;
    apiKey_encrypt: Encrypt;
    extra: Record<string, string>;
  };

  constructor(
    panel: Partial<DatabaseConnectorInfo['database'] & { name: string }> = {}
  ) {
    super('database', panel.name || '');
    this.database = {
      type: panel.type || 'postgres',
      database: panel.database || '',
      username: panel.username || '',
      password_encrypt: panel.password_encrypt || new Encrypt(''),
      address: panel.address || '',
      extra: panel.extra || {},
      apiKey_encrypt: panel.apiKey_encrypt || new Encrypt(''),
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
  resultMeta: PanelResult;
  lastEdited: Date;
  pageId: string;

  constructor(
    type: PanelInfoType,
    pageId: string,
    name?: string,
    content?: string
  ) {
    this.content = content || '';
    this.type = type;
    this.name = name || '';
    this.id = uuid.v4();
    this.resultMeta = new PanelResult();
    this.lastEdited = new Date();
    this.pageId = pageId;
  }

  static fromJSON(raw: any): PanelInfo {
    raw = raw || {};

    // Migrate panel name from sql to database
    if (raw.type === 'sql') {
      raw.type = 'database';
      raw.database = raw.sql;
      delete raw.sql;
    }

    let pit: PanelInfo = mergeDeep(
      new PanelInfo(raw.type || 'literal', raw.pageId),
      raw
    );

    pit.lastEdited =
      (typeof raw.lastEdited === 'string'
        ? new Date(raw.lastEdited)
        : raw.lastEdited) || pit.lastEdited;

    switch (pit.type) {
      case 'table':
        pit = mergeDeep(new TablePanelInfo(pit.pageId), pit);
        break;
      case 'http':
        pit = mergeDeep(new HTTPPanelInfo(pit.pageId), pit);
        break;
      case 'graph':
        pit = mergeDeep(new GraphPanelInfo(pit.pageId), pit);
        break;
      case 'program':
        pit = mergeDeep(new ProgramPanelInfo(pit.pageId), pit);
        break;
      case 'literal':
        pit = mergeDeep(new LiteralPanelInfo(pit.pageId), pit);
        break;
      case 'database':
        pit = mergeDeep(new DatabasePanelInfo(pit.pageId), pit);
        break;
      case 'file':
        pit = mergeDeep(new FilePanelInfo(pit.pageId), pit);
        break;
      case 'filagg':
        pit = mergeDeep(new FilterAggregatePanelInfo(pit.pageId), pit);
        break;
    }

    pit.resultMeta = PanelResult.fromJSON(raw.resultMeta);
    return pit;
  }
}

export class ProgramPanelInfo extends PanelInfo {
  program: {
    type: SupportedLanguages;
  };

  constructor(
    pageId: string,
    {
      name,
      type,
      content,
    }: Partial<
      ProgramPanelInfo['program'] & { content: string; name: string }
    > = {}
  ) {
    super('program', pageId, name || '', content || '');
    this.program = {
      type: type || 'python',
    };
  }
}

export interface GraphField {
  field: string;
  label: string;
}

export type GraphPanelInfoType = 'bar' | 'pie' | 'line';

export type PanelInfoWidth = 'small' | 'medium' | 'large';

export class GraphPanelInfo extends PanelInfo {
  graph: {
    panelSource: string;
    ys: Array<GraphField>;
    x: string;
    uniqueBy: string;
    type: GraphPanelInfoType;
    width: PanelInfoWidth;
    colors: {
      unique: boolean;
    };
  };

  constructor(
    pageId: string,
    defaults: Partial<
      GraphPanelInfo['graph'] & { content: string; name: string }
    > = {}
  ) {
    super('graph', pageId, defaults.name, defaults.content);
    this.graph = {
      panelSource: defaults.panelSource || '',
      x: defaults.x || '',
      uniqueBy: defaults.uniqueBy || '',
      ys: defaults.ys || [],
      type: defaults.type || 'line',
      width: defaults.width || 'small',
      colors: defaults.colors || {
        unique: false,
      },
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

export type TimeSeriesRange = {
  field: string;
  sortOn?: string;
  sortAsc?: boolean;
} & (
  | {
      rangeType: 'absolute';
      begin_date: Date;
      end_date: Date;
    }
  | {
      rangeType: 'relative';
      relative: TimeSeriesRelativeTimes;
    }
  | {
      rangeType: 'fixed';
      fixed: TimeSeriesFixedTimes;
    }
);

export class DatabasePanelInfo extends PanelInfo {
  database: {
    connectorId?: string;
    range: TimeSeriesRange;
    table: string;
    step: number;
    extra: Record<string, string>;
  };

  constructor(
    pageId: string,
    panel: Partial<
      DatabasePanelInfo['database'] & { content: string; name: string }
    > = {}
  ) {
    super('database', pageId, panel.name || '', panel.content || '');
    this.database = {
      connectorId: panel.connectorId || '',
      range: panel.range || {
        field: '',
        rangeType: 'relative',
        relative: 'last-hour',
      },
      table: panel.table || '',
      step: panel.step || 60,
      extra: panel.extra || {},
    };
  }
}

export class HTTPPanelInfo extends PanelInfo {
  http: HTTPConnectorInfo;

  constructor(
    pageId: string,
    name?: string,
    http?: HTTPConnectorInfo,
    content?: string
  ) {
    super('http', pageId, name, content);
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
    panelSource: string;
    width: PanelInfoWidth;
    rowNumbers: boolean;
  };

  constructor(
    pageId: string,
    defaults: Partial<
      TablePanelInfo['table'] & { content: string; name: string }
    > = {}
  ) {
    super('table', pageId, defaults.name, defaults.content);
    this.table = {
      columns: defaults.columns || [],
      panelSource: defaults.panelSource || '',
      width: defaults.width || 'small',
      rowNumbers: defaults.rowNumbers || true,
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
    panelSource: string;
    filter: string;
    range: TimeSeriesRange;
    aggregateType: AggregateType;
    groupBy: string;
    aggregateOn: string;
    sortOn: string;
    sortAsc: boolean;
    windowInterval: string;
    limit: number;
  };

  constructor(
    pageId: string,
    panel: Partial<FilterAggregatePanelInfo['filagg'] & { name: string }> = {}
  ) {
    super('filagg', pageId, panel.name || '', '');
    this.filagg = {
      panelSource: panel.panelSource || '',
      filter: panel.filter || '',
      aggregateType: panel.aggregateType || 'none',
      groupBy: panel.groupBy || '',
      aggregateOn: panel.aggregateOn || '',
      sortOn: panel.sortOn || '',
      sortAsc: panel.sortAsc || false,
      limit: panel.limit || 100,
      windowInterval: panel.windowInterval || '',
      range: panel.range || {
        field: '',
        rangeType: 'relative',
        relative: 'last-hour',
      },
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
    pageId: string,
    panel: Partial<FilePanelInfo['file'] & { panelName: string }> = {}
  ) {
    super('file', pageId, panel.panelName, '');
    this.file = {
      name: panel.name || '',
      content: panel.content || new ArrayBuffer(0),
      contentTypeInfo: panel.contentTypeInfo || new ContentTypeInfo(),
    };
  }
}

export class LiteralPanelInfo extends PanelInfo {
  literal: {
    contentTypeInfo: ContentTypeInfo;
  };

  constructor(
    pageId: string,
    {
      name,
      content,
      contentTypeInfo,
    }: Partial<
      LiteralPanelInfo['literal'] & { content: string; name: string }
    > = {}
  ) {
    super('literal', pageId, name || '', content || '');
    this.literal = {
      contentTypeInfo: contentTypeInfo || new ContentTypeInfo(),
    };
  }
}

export class DashboardPanel {
  id: string;
  panelId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ProjectPageVisibility = 'no-link' | 'private-link' | 'public-link';

export class Dashboard {
  id: string;
  disabled: boolean;
  refreshPeriod: number;
  visibility: ProjectPageVisibility;
  name: string;
  panels: Array<{ name: string; id: string }>;
  exports: Array<{ name: string; id: string }>;
}

// For exports specifically
export type Destination = { id: string } & {
  // Leaves room for other destination types in the future
  type: 'email';
  from: string;
  recipients: string;
  server: string;
  username: string;
  password_encrypt: Encrypt;
};

export class Export {
  period: 'day' | 'week' | 'month';
  disabled: boolean;
  name: string;
  id: string;
  destinations: Array<Destination>;

  constructor(defaults: Partial<Export> = {}) {
    this.period = defaults.period || 'day';
    this.name = defaults.name || 'DataStation Export';
    this.id = uuid.v4();
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

export function doOnMatchingFields<T>(
  ps: any,
  check: (key: string) => boolean,
  cb: (f: T, path: string) => T
) {
  const stack: Array<[any, Array<string>]> = [[ps, []]];

  while (stack.length) {
    const [top, path] = stack.pop();

    if (top && typeof top === 'object') {
      for (const [elPath, el] of Object.entries(top)) {
        stack.push([el, [...path, elPath]]);
      }
    }

    const p = path.filter(Boolean).join('.');
    if (check(p)) {
      setPath(ps, p, cb(top, p));
    }
  }
}

export function doOnEncryptFields(
  ps: any,
  cb: (f: Encrypt, path: string) => Encrypt
) {
  return doOnMatchingFields(ps, (f) => f.endsWith('_encrypt'), cb);
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

  static fromJSON(raw: any, external = true): ProjectState {
    raw = raw || {};
    const ps = new ProjectState();
    ps.projectName = raw.projectName || '';
    ps.pages = (raw.pages || []).map(ProjectPage.fromJSON);
    ps.connectors = (raw.connectors || []).map(ConnectorInfo.fromJSON);
    ps.servers = (raw.servers || []).map(ServerInfo.fromJSON);
    ps.id = raw.id || uuid.v4();
    ps.originalVersion = raw.originalVersion || VERSION;
    ps.lastVersion = raw.lastVersion || VERSION;
    if (external) {
      doOnEncryptFields(ps, (f, p) => {
        const new_ = new Encrypt(null);
        new_.encrypted = true;
        return new_;
      });
    }
    doOnMatchingFields<Date>(
      ps,
      (path) => path.endsWith('_date'),
      (d) => {
        const nd = new Date(d);
        if (String(nd) === 'Invalid Date') {
          return new Date();
        }

        return nd;
      }
    );
    return ps;
  }
}

export const DEFAULT_PROJECT: ProjectState = (() => {
  const page = new ProjectPage('CSV Discovery Example');

  const ppi = new ProgramPanelInfo(page.id, {
    name: 'Transform with SQL',
    type: 'sql',
    content: `SELECT name, age+5 AS age FROM DM_getPanel('Raw CSV Text');`,
  });

  const gpi = new GraphPanelInfo(page.id, { name: 'Display' });
  gpi.graph.ys = [{ field: 'age', label: 'Age' }];
  gpi.graph.x = 'name';
  gpi.graph.panelSource = ppi.id;

  page.panels = [
    new LiteralPanelInfo(page.id, {
      name: 'Raw CSV Text',
      content: 'name,age\nMorgan,12\nJames,17',
      contentTypeInfo: new ContentTypeInfo('text/csv'),
    }),
    ppi,
    gpi,
  ];

  return new ProjectState('Example project', [page]);
})();
