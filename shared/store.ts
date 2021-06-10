export type ConnectorInfoType = 'sql';

export class ConnectorInfo {
  name: string;
  type: ConnectorInfoType;

  constructor(name?: string, type?: ConnectorInfoType) {
    this.name = name || 'Untitled Connector';
    this.type = type || 'sql';
  }
}

export type SQLConnectorInfoType = 'postgres';

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
    super(name, 'sql');
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
  | 'sql';

export class PanelInfo {
  content: string;
  type: PanelInfoType;
  name: string;

  constructor(name: string, type: PanelInfoType, content?: string) {
    this.content = content || '';
    this.type = type;
    this.name = name;
  }
}

export type ProgramPanelInfoType = 'javascript' | 'python';

export class ProgramPanelInfo extends PanelInfo {
  program: {
    type: ProgramPanelInfoType;
  };

  constructor(name: string, type?: ProgramPanelInfoType, content?: string) {
    super(name, 'program', content);
    this.program = {
      type: type || 'javascript',
    };
  }
}

export interface GraphY {
  field: string;
  label: string;
}

export type GraphPanelInfoType = 'bar';

export class GraphPanelInfo extends PanelInfo {
  graph: {
    panelSource: number;
    y: GraphY;
    x: string;
    type: GraphPanelInfoType;
  };

  constructor(
    name: string,
    panelSource?: number,
    y?: GraphY,
    x?: string,
    type?: GraphPanelInfoType,
    content?: string
  ) {
    super(name, 'graph', content);
    this.graph = {
      panelSource: panelSource || 0,
      x: x || '',
      y: y || { field: '', label: '' },
      type: type || 'bar',
    };
  }
}

export class SQLPanelInfo extends PanelInfo {
  sql: SQLConnectorInfo;

  constructor(name: string, sql?: SQLConnectorInfo, content?: string) {
    super(name, 'sql', content);
    this.sql = new SQLConnectorInfo();
  }
}

export type HTTPPanelInfoType = 'csv' | 'json';

export class HTTPPanelInfo extends PanelInfo {
  http: {
    type: HTTPPanelInfoType;
  };

  constructor(name: string, type?: HTTPPanelInfoType, content?: string) {
    super(name, 'http', content);
    this.http = {
      type: type || 'json',
    };
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
    name: string,
    columns: Array<TableColumn> = [],
    panelSource: number = 0,
    content?: string
  ) {
    super(name, 'table', content);
    this.table = {
      columns,
      panelSource,
    };
  }
}

export type LiteralPanelInfoType = 'csv' | 'json';

export class LiteralPanelInfo extends PanelInfo {
  literal: {
    type: LiteralPanelInfoType;
  };

  constructor(name: string, type?: LiteralPanelInfoType, content?: string) {
    super(name, 'literal', content);
    this.literal = {
      type: type || 'csv',
    };
  }
}

export interface ProjectPage {
  panels: Array<PanelInfo>;
  name: string;
}

export interface ProjectState {
  pages: Array<ProjectPage>;
  projectName: string;
  currentPage: number;
  connectors: Array<ConnectorInfo>;
}
