import React from 'react';
import { PanelInfo } from '../../shared/state';

export function Panel({ panel }: { panel: PanelInfo }) {
  const panelMetadata = PANEL_UI_DETALS[panel.type];

  if (!panelMetadata.dashboard) {
    return null;
  }

  return (
    <div className="panel">
      <div className="panel-body-container">
        <div className="panel-body">
          <panelMetadata.body
            panel={panel}
            panels={panels}
            updatePanel={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
