import { PanelInfo, PanelResult } from '../../shared/state';

export interface PanelDetailsProps {
  panel: PanelInfo;
  panels: Array<PanelInfo>;
  updatePanel: (d: PanelInfo) => void;
  panelIndex: number;
}

export interface PanelBodyProps {
  panel: PanelInfo;
  panels: Array<PanelInfo>;
  updatePanel: (d: PanelInfo) => void;
  keyboardShortcuts: (e: React.KeyboardEvent) => void;
}

export interface PanelUIDetails {
  icon: string;
  eval(
    panel: PanelInfo,
    panelResults: Array<PanelResult>,
    indexIdMap: Array<string>,
    connectors: Array<ConnectorInfo>,
    servers: Array<ServerInfo>
  ): Promise<PanelResult>;
  id: PanelInfoType;
  label: string;
  details: React.ElementType<PanelDetailsProps>;
  body: React.ElementType<PanelBodyProps> | null;
  alwaysOpen: boolean;
  previewable: boolean;
  hasStdout: boolean;
  info: React.ElementType<{ panel: PanelInfo }> | null;
  factory: () => PanelInfo;
  killable: boolean;
}

export function guardPanel<T>(panel: PanelInfo, t: PanelInfoType): T {
  if (panel.type !== t) {
    throw new Error(`Panel type mismatch. Expected ${t}.`);
  }

  return panel as T;
}
