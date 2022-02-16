import React from 'react';
import { ProjectPage } from './../shared/state';
import { Alert } from './components/Alert';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Select } from './components/Select';
import { Panel } from './dashboard/Panel';

export function ExternalDashboard() {
  const projectId = location.pathname.split('/')[2];
  const pageId = location.pathname.split('/')[3];
  const [page, setPage] = React.useState<ProjectPage>(null);
  const [error, setError] = React.useState(null);

  async function grabPage() {
    try {
      const rsp = await fetch(`/a/dashboard/${projectId}/${pageId}`);
      if (rsp.status !== 200) {
        throw await rsp.json();
      }

      setPage(await rsp.json());
      setError(null);
    } catch (e) {
      setError(e);
    }
  }

  React.useEffect(() => {
    grabPage();
  });

  // Minimum of 60 seconds, default to 1 hour.
  const refreshPeriod = Math.max(+page.refreshPeriod || 60 * 60, 60);

  React.useEffect(() => {
    let done = false;
    let i: ReturnType<typeof setTimeout> = null;
    async function loop() {
      while (!done) {
        clearTimeout(i);
        await new Promise<void>((resolve, reject) => {
          try {
            i = setTimeout(() => {
              try {
                grabPage();
                resolve();
              } catch (e) {
                reject(e);
              }

              // Randomness to help avoid competition with other pages.
            }, (refreshPeriod + Math.random() * 60) * 1000);
          } catch (e) {
            reject(e);
          }
        });
      }
    }

    loop();

    return () => {
      done = true;
      clearInterval(i);
    };
  }, [
    page && page.refreshPeriod,
    page && page.panels.map((p) => p.id).join(','),
  ]);

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
          There are no graph or table panels on this page ({page.name}) to
          display! Try adding a graph or table panel in the editor view.
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="section-subtitle vertical-align-center">
        <Select
          label="Refreshes every"
          onChange={() => {}}
          disabled
          value={String(refreshPeriod)}
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
  );
}