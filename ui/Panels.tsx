import * as React from 'react';

import { ProjectPage, PanelInfo, LiteralPanelInfo } from './../shared/state';

import { PanelResult } from './ProjectStore';
import { Panel } from './Panel';
import { Button } from './component-library/Button';

export function Panels({
  page,
  updatePage,
  reevalPanel,
  panelResults,
}: {
  page: ProjectPage;
  updatePage: (page: ProjectPage) => void;
  panelResults: Array<PanelResult>;
  reevalPanel: (panelIndex: number) => void;
}) {
  function movePanel(from: number, to: number) {
    const panel = page.panels[from];
    page.panels.splice(from, 1);
    page.panels.splice(to, 0, panel);
    updatePage(page);
  }

  function removePanel(at: number) {
    page.panels.splice(at, 1);
    updatePage(page);
  }

  function updatePanel(page: ProjectPage, panelIndex: number) {
    return (panel: PanelInfo) => {
      page.panels[panelIndex] = panel;
      updatePage(page);
    };
  }

  function newPanel(panelIndex: number) {
    return (
      <div className="new-panel">
        <Button
          onClick={() => {
            const panel = new LiteralPanelInfo('Untitled panel');
            if (panelIndex) {
              page.panels.splice(panelIndex + 1, 0, panel);
            } else {
              page.panels.push(panel);
            }

            updatePage(page);
          }}
        >
          New Panel
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div>
        {page.panels.map((panel, panelIndex) => (
          <React.Fragment>
            <Panel
              key={panelIndex}
              panel={panel}
              updatePanel={updatePanel(page, panelIndex)}
              panelResults={panelResults}
              reevalPanel={reevalPanel}
              panelIndex={panelIndex}
              movePanel={movePanel}
              removePanel={removePanel}
              panelCount={page.panels.length}
            />
            {newPanel(panelIndex)}
          </React.Fragment>
        ))}
        {page.panels.length === 0 && newPanel(0)}
      </div>
    </div>
  );
}
