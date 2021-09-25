import {PanelInfo, PanelResultMeta} from '../../shared/state';

export interface PanelDetailsProps {
  panel: PanelInfo;
  panels: Array<PanelInfo>;
  panelResults: Array<PanelResultMeta>;
  updatePanel: (d: PanelInfo) => void;
}

export interface PanelBodyProps {
  panel: PanelInfo;
  updatePanel: (d: PanelInfo) => void;
  keyboardShortcuts: (e: React.KeyboardEvent) => void;
}
