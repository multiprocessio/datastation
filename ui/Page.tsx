import * as React from 'react';

import { ConnectorInfo, ProjectPage, PanelResult } from '../shared/state';

import { Panels } from './Panels';
import { evalPanel } from './Panel';

export function Page({
  page,
  connectors,
  updatePage,
  panelResults,
  setPanelResults,
}: {
  page: ProjectPage;
  updatePage: (page: ProjectPage) => void;
  connectors: Array<ConnectorInfo>;
  panelResults: Array<PanelResult>;
  setPanelResults: (panelIndex: number, results: PanelResult) => void;
}) {
  async function reevalPanel(panelIndex: number, reset?: boolean) {
    const panel = panelResults[panelIndex];
    panel.lastRun = null;
    panel.loading = true;
    if (reset) {
      panel.loading = false;
      setPanelResults(panelIndex, panel);
      return;
    }

    try {
      const [r, stdout] = await evalPanel(
        page,
        panelIndex,
        panelResults,
        connectors
      );
      setPanelResults(panelIndex, {
        lastRun: new Date(),
        value: r,
        stdout,
        loading: false,
      });
    } catch (e) {
      setPanelResults(panelIndex, {
        loading: false,
        lastRun: new Date(),
        exception: e.stack,
        stdout: '',
      });
    }
  }

  return (
    <Panels
      page={page}
      updatePage={updatePage}
      reevalPanel={reevalPanel}
      panelResults={panelResults}
    />
  );
}
