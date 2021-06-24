import * as React from 'react';

import { ConnectorInfo, ProjectPage } from '../shared/state';

import { Panels } from './Panels';
import { evalPanel } from './Panel';
import { PanelResult } from './ProjectStore';

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
    if (reset) {
      setPanelResults(panelIndex, {
        ...panelResults[panelIndex],
        lastRun: null,
      });
      return;
    }

    try {
      const [r, stdout] = await evalPanel(
        page,
        panelIndex,
        panelResults,
        connectors
      );
      setPanelResults(panelIndex, { lastRun: new Date(), value: r, stdout });
    } catch (e) {
      setPanelResults(panelIndex, {
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
