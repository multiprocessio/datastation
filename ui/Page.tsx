import * as React from 'react';

import { ProjectPage } from './../shared/state';

import { Panels } from './Panels';
import { PanelResult } from './ProjectStore';

export function Page({
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
  return (
    <Panels
      page={page}
      updatePage={updatePage}
      reevalPanel={reevalPanel}
      panelResults={panelResults}
    />
  );
}
