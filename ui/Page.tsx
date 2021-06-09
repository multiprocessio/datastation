import * as React from 'react';

import { Panels } from './Panels';
import { evalPanel } from './Panel';
import { ProjectPage, PanelResult } from './ProjectStore';

export function Page({
  page,
  updatePage,
}: {
  page: ProjectPage;
  updatePage: (page: ProjectPage) => void;
}) {
  const [panelResults, setPanelResults] = React.useState<Array<PanelResult>>(
    []
  );
  async function reevalPanel(panelIndex: number) {
    try {
      const r = await evalPanel(page, panelIndex, panelResults);
      panelResults[panelIndex] = { lastRun: new Date(), value: r };
    } catch (e) {
      panelResults[panelIndex] = { lastRun: new Date(), exception: e.stack };
    } finally {
      setPanelResults({ ...panelResults });
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
