import * as React from 'react';

import { ProjectPage } from './../shared/state';

import { Panels } from './Panels';
import { evalPanel } from './Panel';
import { PanelResult } from './ProjectStore';

export function Page({
  page,
  updatePage,
  panelResults,
  setPanelResults,
}: {
  page: ProjectPage;
  updatePage: (page: ProjectPage) => void;
  panelResults: Array<PanelResult>;
  setPanelResults: (panelIndex: number, results: PanelResult) => void;
}) {
  async function reevalPanel(panelIndex: number) {
    try {
      const r = await evalPanel(page, panelIndex, panelResults);
      setPanelResults(panelIndex, { lastRun: new Date(), value: r });
    } catch (e) {
      setPanelResults(panelIndex, {
        lastRun: new Date(),
        exception: e.stack,
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
