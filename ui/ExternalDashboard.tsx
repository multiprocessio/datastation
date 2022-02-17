import React from 'react';
import { APP_NAME, MODE } from '../shared/constants';
import { ProjectPage } from './../shared/state';
import { Alert } from './components/Alert';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loading } from './components/Loading';
import { Select } from './components/Select';
import { Version } from './components/Version';
import { Panel } from './dashboard/Panel';

export function ExternalDashboard() {
  const projectId = location.pathname.split('/')[2];
  const pageId = location.pathname.split('/')[3];
  const [page, setPage] = React.useState<ProjectPage>(null);
  const [error, setError] = React.useState(null);
  const [firstLoad, setFirstLoad] = React.useState(true);

  async function grabPage() {
    try {
      const rsp = await fetch(`/a/dashboard/${projectId}/${pageId}`);
      if (rsp.status !== 200) {
        throw await rsp.json();
      }

      setPage(ProjectPage.fromJSON(await rsp.json()));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      if (firstLoad) {
        setFirstLoad(false);
      }
    }
  }

  // Load once on page load
  React.useEffect(() => {
    grabPage();
  }, []);

  // Minimum of 60 seconds, default to 1 hour.
  const refreshPeriod = Math.max(
    (page ? +page.refreshPeriod : 0) || 60 * 60,
    60
  );

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
      </main>
      <Version />
    </div>
  );
}
