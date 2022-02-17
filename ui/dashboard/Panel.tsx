import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import React from 'react';
import { PanelInfo } from '../../shared/state';
import { PANEL_UI_DETAILS } from '../panels';

export function Panel({ panel }: { panel: PanelInfo }) {
  const panelMetadata = PANEL_UI_DETAILS[panel.type];

  if (!panelMetadata.dashboard) {
    return null;
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-header vertical-align-center">
          <span className="panel-name">{panel.name}</span>
          <span className="flex-right">
            {panel.resultMeta && panel.resultMeta.lastRun
              ? formatDistanceToNow(panel.resultMeta.lastRun, {
                  addSuffix: true,
                  includeSeconds: true,
                })
              : null}
          </span>
        </div>
      </div>
      <div className="panel-body-container">
        <div className="panel-body">
          <panelMetadata.body
            panel={panel}
            panels={[]}
            keyboardShortcuts={(e: unknown) => {}}
            updatePanel={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
