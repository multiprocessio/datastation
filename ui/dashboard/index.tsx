import React from 'react';
import { ProjectContext } from '../ProjectStore';
import { UrlStateContext } from '../urlState';
import { Panel } from './Panel';

export function Dashboard() {
  const {
    state: { page: pageIndex },
  } = React.useContext(UrlStateContext);
  const {
    state: { pages },
  } = React.useContext(ProjectContext);
  const { panels } = pages[pageIndex];

  return (
    <React.Fragment>
      {panels.map((panel) => (
        <ErrorBoundary key={panel.id}>
          <Panel panel={panel} />
        </ErrorBoundary>
      ))}
    </React.Fragment>
  );
}
