import { Shape } from 'shape';
import * as uuid from 'uuid';
import { VERSION } from './constants';
import { SupportedLanguages } from './languages';
import { mergeDeep } from './object';

export class PanelResult {
  exception?: Error;
  value?: Array<any>;
  preview: string;
  stdout: string;
  shape: Shape;
  size: number;
  contentType: string;

  constructor() {
    this.stdout = '';
    this.shape = { kind: 'unknown' };
    this.preview = '';
    this.size = 0;
    this.contentType = 'unknown';
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

export type ServerInfoType = 'ssh-agent' | 'password' | 'private-key';

export class ServerInfo {
  name: string;
  address: string;
  port: number;
  type: ServerInfoType;
  username: string;
  password: string;
  privateKeyFile: string;
  passphrase: string;
  id: string;

  constructor(
    name?: string,
    address?: string,
    port?: number,
    type?: ServerInfoType,
    username?: string,
    password?: string,
    privateKeyFile?: string,
    passphrase?: string
  ) {
    this.type = type || 'private-key';
    this.name = name || 'Untitled server';
    this.address = address || '';
    this.port = port || 22;
    this.username = username || '';
    this.password = password || '';
    this.privateKeyFile = privateKeyFile || '~/.ssh/id_rsa';
    this.passphrase = passphrase || '';
    this.id = uuid.v4();
  }

  static fromJSON(raw: any): ServerInfo {
    return mergeDeep(new ServerInfo(), raw);
  }
}

export type Proxy<T, S> = T & {
  server?: ServerInfo;
  connector?: S;
};

export type ConnectorInfoType = 'sql' | 'http';

export class ConnectorInfo {
  name: string;
  type: ConnectorInfoType;
  id: string;
  serverId?: string;

  constructor(type?: ConnectorInfoType, name?: string, serverId?: string) {
    this.name = name || 'Untitled Connector';
    this.type = type || 'sql';
    this.serverId = serverId;
    this.id = uuid.v4();
  }

  static fromJSON(raw: any): ConnectorInfo {
    raw = raw || {};
    const ci = mergeDeep(new ConnectorInfo(), raw);

    switch (raw.type) {
      case 'sql':
        return mergeDeep(new SQLConnectorInfo(), ci);
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

export type SQLConnectorInfoType =
  | 'postgres'
  | 'mysql'
  | 'sqlite'
  | 'oracle'
  | 'sqlserver';

export class SQLConnectorInfo extends ConnectorInfo {
  sql: {
    type: SQLConnectorInfoType;
    database: string;
    username: string;
    password: string;
    address: string;
  };

  constructor(
    name?: string,
    type?: SQLConnectorInfoType,
    database?: string,
    username?: string,
    password?: string,
    address?: string
  ) {
    super('sql', name);
    this.sql = {
      type: type || 'postgres',
      database: database || '',
      username: username || '',
      password: password || '',
      address: address || '',
    };
  }
}

export type PanelInfoType =
  | 'table'
  | 'http'
  | 'graph'
  | 'program'
  | 'literal'
  | 'sql'
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
      case 'sql':
        pit = mergeDeep(new SQLPanelInfo(), pit);
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

export class SQLPanelInfo extends PanelInfo {
  sql: {
    type: SQLConnectorInfoType;
    connectorId?: string;
  };

  constructor(
    name?: string,
    type?: SQLConnectorInfoType,
    connectorId?: string,
    content?: string
  ) {
    super('sql', name, content);
    this.sql = {
      type: type || 'postgres',
      connectorId,
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
    content?: string
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
