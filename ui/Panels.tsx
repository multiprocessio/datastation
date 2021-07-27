import * as React from 'react';
import {
  LiteralPanelInfo,
  PanelInfo,
  PanelResultMeta,
  ProjectPage,
} from '../shared/state';
import { Button } from './component-library/Button';
import { Panel } from './Panel';

export function Panels({
  page,
  updatePage,
  reevalPanel,
  panelResults,
}: {
  page: ProjectPage;
  updatePage: (page: ProjectPage) => void;
  panelResults: Array<PanelResultMeta>;
  reevalPanel: (panelIndex: number, reset?: boolean) => void;
}) {
  function movePanel(from: number, to: number) {
    const panel = page.panels[from];
    page.panels.splice(from, 1);
    page.panels.splice(to, 0, panel);
    updatePage(page);
    reevalPanel(to, true);
    reevalPanel(from, true);
  }

  function removePanel(at: number) {
    page.panels.splice(at, 1);
    updatePage(page);
  }

  function updatePanel(page: ProjectPage, panelIndex: number) {
    return (panel: PanelInfo) => {
      page.panels[panelIndex] = panel;
      updatePage(page);
      reevalPanel(panelIndex, true);
    };
  }

  function newPanel(panelIndex: number) {
    return (
      <div className="new-panel">
        <Button
          onClick={() => {
            const panel = new LiteralPanelInfo('Untitled panel');
            page.panels.splice(panelIndex + 1, 0, panel);
            updatePage(page);
          }}
        >
          New Panel
        </Button>
      </div>
    );
  }

  return (
    <React.Fragment>
      {newPanel(-1)}
      {page.panels.map((panel, panelIndex) => (
        <React.Fragment key={panel.id}>
          <Panel
            key={panel.id}
            panel={panel}
            updatePanel={updatePanel(page, panelIndex)}
            panelResults={panelResults}
            reevalPanel={reevalPanel}
            panelIndex={panelIndex}
            movePanel={movePanel}
            removePanel={removePanel}
            panels={page.panels}
          />
          {newPanel(panelIndex)}
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}
