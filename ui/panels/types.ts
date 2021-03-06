import {
  ConnectorInfo,
  PanelInfo,
  PanelInfoType,
  PanelResult,
  ServerInfo,
} from '../../shared/state';

export interface PanelDetailsProps<T extends PanelInfo> {
  panel: T;
  panels: Array<PanelInfo>;
  updatePanel: (d: T) => void;
  panelIndex: number;
}

export interface PanelBodyProps<T extends PanelInfo> {
  panel: T;
  panels: Array<PanelInfo>;
  updatePanel: (d: T) => void;
  keyboardShortcuts: (e: React.KeyboardEvent) => void;
}

export interface PanelUIDetails<T extends PanelInfo> {
  icon: string;
  eval(
    panel: T,
    panels: Array<PanelInfo>,
    idMap: Record<number | string, string>,
    connectors: Array<ConnectorInfo>,
    servers: Array<ServerInfo>
  ): Promise<PanelResult>;
  id: PanelInfoType;
  label: string;
  details: React.FC<PanelDetailsProps<T>>;
  body: React.FC<PanelBodyProps<T>> | null;
  hideBody?: (p: T, cs: Array<ConnectorInfo>) => boolean;
  previewable: boolean;
  hasStdout: boolean;
  info: ({ panel }: { panel: T }) => React.ReactElement | null;
  factory: (pageId: string, name: string) => T;
  dashboard?: boolean;
}
