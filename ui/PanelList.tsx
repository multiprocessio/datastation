import { IconChartBar, IconTable } from '@tabler/icons';
import * as React from 'react';
import {
  PanelInfo,
  PanelResultMeta,
  ProgramPanelInfo,
  ProjectPage,
  TablePanelInfo,
} from '../shared/state';
import { Button } from './components/Button';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Panel } from './Panel';
import { PANEL_GROUPS, PANEL_UI_DETAILS } from './panels';
import { UrlStateContext } from './urlState';

export function PanelList({
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
    reevalPanel(page.panels[from].id, true);
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
    };
  }

  function newPanel(panelIndex: number) {
    const panel = page.panels[panelIndex];

    function makePanel(type: string, prefix: string) {
      const next = new TablePanelInfo({
        name: prefix + ' ' + panel.name,
        panelSource: panel.id,
      });
      page.panels.splice(panelIndex + 1, 0, next);
      updatePage(page);
    }

    const offerToGraph =
      panel &&
      !['graph', 'table'].includes(panel.type) &&
      panel.resultMeta &&
      panel.resultMeta.shape &&
      panel.resultMeta.shape.kind === 'array' &&
      panel.resultMeta.shape.children.kind === 'object';

    return (
      <div className="new-panel">
        <Button
          onClick={() => {
            const panel = new ProgramPanelInfo({
              name: `Untitled panel #${page.panels.length + 1}`,
              type: 'python',
            });
            page.panels.splice(panelIndex + 1, 0, panel);
            updatePage(page);
          }}
          options={PANEL_GROUPS.map((group) => (
            <optgroup label={group.label} key={group.label}>
              {group.panels.map((name) => {
                const panelDetails = PANEL_UI_DETAILS[name];
                return (
                  <option value={panelDetails.id} key={panelDetails.id}>
                    {panelDetails.label}
                  </option>
                );
              })}
            </optgroup>
          ))}
        >
          Add Panel
        </Button>
        {offerToGraph ? (
          <React.Fragment>
            <span title="Generate a graph for the above panel">
              <Button onClick={() => makePanel('graph', 'Graph of ')} icon>
                <IconChartBar />
              </Button>
            </span>
            <span title="Generate a table for the above panel">
              <Button onClick={() => makePanel('table', 'Data from')} icon>
                <IconTable />
              </Button>
            </span>
          </React.Fragment>
        ) : null}
      </div>
    );
  }

  const {
    state: { fullScreen },
  } = React.useContext(UrlStateContext);
  const fullScreenIndex = fullScreen
    ? page.panels.findIndex((p) => p.id === fullScreen)
    : null;
  if (typeof fullScreenIndex === 'number' && fullScreenIndex >= 0) {
    const panel = page.panels[fullScreenIndex];
    return (
      <Panel
        panel={panel}
        updatePanel={updatePanel(page, panel.id)}
        panelResults={panelResults}
        reevalPanel={reevalPanel}
        panelIndex={fullScreenIndex}
        movePanel={movePanel}
        removePanel={removePanel}
        panels={page.panels}
      />
    );
  }

  return (
    <React.Fragment>
      {newPanel(-1)}
      {page.panels.map((panel, panelIndex) => (
        <ErrorBoundary key={panel.id}>
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
        </ErrorBoundary>
      ))}
    </React.Fragment>
  );
}
