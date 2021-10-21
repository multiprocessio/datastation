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
    indexIdMap: Array<string>,
    connectors: Array<ConnectorInfo>,
    servers: Array<ServerInfo>
  ): Promise<PanelResult>;
  id: PanelInfoType;
  label: string;
  details: React.ElementType<PanelDetailsProps<T>>;
  body: React.ElementType<PanelBodyProps<T>> | null;
  previewable: boolean;
  hasStdout: boolean;
  info: React.ElementType<{ panel: T }> | null;
  factory: () => T;
  dashboard?: boolean;
}
