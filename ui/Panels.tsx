import * as React from 'react';
import {
  PanelInfo,
  PanelResultMeta,
  ProgramPanelInfo,
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
  reevalPanel: (panelId: string, reset?: boolean) => void;
}) {
  function movePanel(from: number, to: number) {
    const panel = page.panels[from];
    page.panels.splice(from, 1);
    page.panels.splice(to, 0, panel);
    updatePage(page);
    reevalPanel(page.panels[to].id, true);
    reevalPanel(page.panels[to].id, true);
  }

  function removePanel(at: number) {
    page.panels.splice(at, 1);
    updatePage(page);
  }

  function updatePanel(page: ProjectPage, panelId: string) {
    return (panel: PanelInfo) => {
      const panelIndex = page.panels.findIndex((p) => p.id === panelId);
      page.panels[panelIndex] = panel;
      updatePage(page);
      reevalPanel(panelId, true);
    };
  }

  function newPanel(panelIndex: number) {
    return (
      <div className="new-panel">
        <Button
          onClick={() => {
            const panel = new ProgramPanelInfo(
              `Untitled panel #${panelIndex + 1}`,
              'python'
            );
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
            panel={panel}
            updatePanel={updatePanel(page, panel.id)}
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
