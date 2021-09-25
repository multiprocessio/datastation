import {PanelInfo, PanelResultMeta} from '../../shared/state';

export interface PanelDetailsProps {
  panel: PanelInfo;
  panels: Array<PanelInfo>;
  panelResults: Array<PanelResultMeta>;
  updatePanel: (d: PanelInfo) => void;
  panelIndex: number;
}

export interface PanelBodyProps {
  panel: PanelInfo;
  updatePanel: (d: PanelInfo) => void;
  keyboardShortcuts: (e: React.KeyboardEvent) => void;
}

export interface PanelUIDetails {
  icon: string;
  eval: () => Promise<PanelResult>;
  id: PanelInfoType;
  label: string;
  details: React.Component<PanelDetailsProps>;
  body: React.Component<PanelBodyProps> | null;
  alwaysOpen: boolean;
  previewable: boolean;
  factory: () => PanelInfo;
};
