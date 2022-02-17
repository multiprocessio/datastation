import React from 'react';
import { MODE_FEATURES } from '../../shared/constants';
import { ProjectPage, ProjectPageVisibility } from '../../shared/state';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Select } from '../components/Select';
import { Panel } from './Panel';

const IS_EXPORT = Boolean((window as any).DATASTATION_IS_EXPORT);

export function Dashboard({
  page,
  projectId,
  reevalPanel,
  updatePage,
}: {
  projectId: string;
  page: ProjectPage;
  reevalPanel: (panelId: string, reset?: boolean) => void;
  updatePage: (p: ProjectPage) => void;
}) {
  const { panels } = page;
  // Minimum of 60 seconds, default to 1 hour.
  const refreshPeriod = Math.max(+page.refreshPeriod || 60 * 60, 60);

  async function evalAll() {
    for (let panel of panels) {
      await reevalPanel(panel.id);
    }
  }

  React.useEffect(() => {
    let done = false;
    let i: ReturnType<typeof setTimeout> = null;
    if (IS_EXPORT || !MODE_FEATURES.dashboard) {
      return;
    }

    async function loop() {
      while (!done) {
        clearTimeout(i);
        await new Promise<void>((resolve, reject) => {
          try {
            i = setTimeout(() => {
              try {
                let oldestAttempt = new Date();
                for (let panel of panels) {
                  if (panel.resultMeta.lastRun < oldestAttempt) {
                    oldestAttempt = panel.resultMeta.lastRun;
                  }
                }

                // Make sure we're not competing with other views of this page.
                oldestAttempt.setSeconds(
                  oldestAttempt.getSeconds() + refreshPeriod
                );
                if (oldestAttempt < new Date()) {
                  evalAll();
                }
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
  }, [page.refreshPeriod, panels.map((p) => p.id).join(',')]);

  if (!MODE_FEATURES.dashboard) {
    return (
      <div className="section">
        <div className="text-center">
          This feature is only available in server mode.
        </div>
      </div>
    );
  }

  if (!panels.length) {
    return (
      <div className="section">
        <div className="text-center">
          There are no graph or table panels on this page ({page.name}) to
          display! Try adding a graph or table panel in the editor view.
        </div>
      </div>
    );
  }

  const dashboardLink =
    '/dashboard/' + encodeURIComponent(projectId) + '/' + page.id;

  return (
    <div className="section">
      {!IS_EXPORT && (
        <div className="section-subtitle vertical-align-center">
          {page.visibility === 'no-link' ? null : (
            <a target="_blank" href={dashboardLink}>
              External link
            </a>
          )}
          <Select
            className="flex-right"
            label="External link"
            onChange={(v: string) => {
              page.visibility = v as ProjectPageVisibility;
              updatePage(page);
            }}
            value={page.visibility}
            tooltip={
              'Enabling an external link allows you to share a read-only view of this page. Link with login is not public. Link without login is fully public. Anyone with the link can view the page.'
            }
          >
            <option value="no-link">No link</option>
            <option value="private-link">Link with login</option>
            <option value="public-link">Link without login</option>
          </Select>

          <Select
            label="Refresh every"
            onChange={(v: string) => {
              page.refreshPeriod = +v;
              updatePage(page);
            }}
            value={String(refreshPeriod)}
          >
            <option value={String(60 * 60)}>6 hour</option>
            <option value={String(60 * 60)}>1 hour</option>
            <option value={String(60 * 15)}>15 minutes</option>
            <option value={String(60 * 5)}>5 minutes</option>
            <option value="60">1 minute</option>
          </Select>
        </div>
      )}
      {panels.map((panel) => (
        <ErrorBoundary key={panel.id}>
          <Panel panel={panel} />
        </ErrorBoundary>
      ))}
    </div>
  );
}
