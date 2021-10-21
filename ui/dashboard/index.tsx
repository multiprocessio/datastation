import React from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
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
  const { panels, name } = pages[pageIndex];

  return (
    <div className="main-body">
      <div className="section">
        <div className="section-title">{name}</div>
        {panels.map((panel) => (
          <ErrorBoundary key={panel.id}>
            <Panel panel={panel} />
          </ErrorBoundary>
        ))}
      </div>
    </div>
  );
}
