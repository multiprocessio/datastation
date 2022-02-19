import React from 'react';
import { APP_NAME, MODE } from '../shared/constants';
import { Alert } from './components/Alert';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loading } from './components/Loading';
import { Select } from './components/Select';
import { Version } from './components/Version';
import { useDashboardData } from './dashboard';
import { Panel } from './dashboard/Panel';

export function ExternalDashboard() {
  const projectId = location.pathname.split('/')[2];
  const pageId = location.pathname.split('/')[3];
  const randomMinute = (60 + Math.ceil(Math.random() * 60)) * 1_000;
  const [page, error, firstLoad] = useDashboardData(
    projectId,
    pageId,
    randomMinute
  );

  if (firstLoad) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="section">
        <Alert type="error">{error}</Alert>
      </div>
    );
  }

  if (!page || !page.panels.length) {
    return (
      <div className="section">
        <div className="text-center">
          There are no graph or table panels on this page
          {page ? ` (${page.name})` : ''} to display! Try adding a graph or
          table panel in the editor view.
        </div>
      </div>
    );
  }

  return (
    <div className={`app app--${MODE} app--dashboard`}>
      <header>
        <div className="vertical-align-center">
          {APP_NAME}
          <div className="flex-right">{decodeURIComponent(projectId)}</div>
        </div>
      </header>
      <main>
        <div className="section">
          <div className="section-subtitle vertical-align-center">
            <Select
              label="Refreshes every"
              onChange={() => {}}
              disabled
              value={String(page.refreshPeriod)}
            >
              <option value={String(60 * 60)}>6 hour</option>
              <option value={String(60 * 60)}>1 hour</option>
              <option value={String(60 * 15)}>15 minutes</option>
              <option value={String(60 * 5)}>5 minutes</option>
              <option value="60">1 minute</option>
            </Select>
          </div>
          {page.panels.map((panel) => (
            <ErrorBoundary key={panel.id}>
              <Panel panel={panel} />
            </ErrorBoundary>
          ))}
        </div>
      </main>
      <Version />
    </div>
  );
}
