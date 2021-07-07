import * as React from 'react';

import {
  ServerInfo,
  ConnectorInfo,
  ProjectPage,
  PanelResult,
} from '../shared/state';

import { Panels } from './Panels';
import { evalPanel } from './Panel';

export function Page({
  page,
  connectors,
  servers,
  updatePage,
  panelResults,
  setPanelResults,
}: {
  page: ProjectPage;
  updatePage: (page: ProjectPage) => void;
  connectors: Array<ConnectorInfo>;
  servers: Array<ServerInfo>;
  panelResults: Array<PanelResult>;
  setPanelResults: (
    panelIndex: number,
    results: PanelResult,
    valueChange?: boolean
  ) => void;
}) {
  async function reevalPanel(panelIndex: number, reset?: boolean) {
    let panel = panelResults[panelIndex] || new PanelResult();
    panel.lastRun = null;
    panel.loading = !reset;

    setPanelResults(panelIndex, panel);
    if (reset) {
      return;
    }

    try {
      const [r, stdout] = await evalPanel(
        page,
        panelIndex,
        panelResults,
        connectors,
        servers
      );
      setPanelResults(
        panelIndex,
        {
          lastRun: new Date(),
          value: r,
          stdout,
          loading: false,
        },
        true
      );
    } catch (e) {
      setPanelResults(
        panelIndex,
        {
          loading: false,
          lastRun: new Date(),
          exception: e.stack || e.message,
          stdout: e.stdout,
        },
        true
      );
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
