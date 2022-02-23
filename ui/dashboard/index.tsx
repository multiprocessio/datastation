import React from 'react';
import { MODE_FEATURES } from '../../shared/constants';
import { ProjectPage, ProjectPageVisibility } from '../../shared/state';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Select } from '../components/Select';
import { Loading } from '../components/Loading';
import { Panel } from './Panel';

export async function loop(
  callback: () => Promise<void>,
  frequencyMs: number,
  done: () => boolean
) {
  let i: ReturnType<typeof setTimeout> = null;

  // Do once initially.
  callback();

  while (!done()) {
    clearTimeout(i);
    await new Promise<void>((resolve, reject) => {
      try {
        i = setTimeout(async function timeout() {
          try {
            await callback();
            resolve();
          } catch (e) {
            reject(e);
          }
        }, frequencyMs);
      } catch (e) {
        reject(e);
      }
    });
  }

  clearTimeout(i);
}

export function useDashboardData(
  projectId: string,
  pageId: string,
  frequencyMs: number,
  disabled: boolean
): [ProjectPage, Error, boolean] {
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

  React.useEffect(() => {
    if (disabled) {
      return;
    }

    let done = false;
    loop(grabPage, frequencyMs, () => done);

    return () => {
      done = true;
    };
  }, [page && page.panels.map((p) => p.id).join(',')]);

  return [page, error, firstLoad];
}

export function Dashboard({
  page: { id: pageId, panels },
  projectId,
  updatePage,
  isExport,
  modeFeatures,
}: {
  projectId: string;
  page: ProjectPage;
  updatePage: (p: ProjectPage) => void;
  isExport?: boolean;
  modeFeatures: typeof MODE_FEATURES;
}) {
  const randomSeconds = (5 + Math.ceil(Math.random() * 10)) * 1_000;
  const disabled = isExport || !modeFeatures.dashboard;
  const [page] = useDashboardData(projectId, pageId, randomSeconds, disabled);

  if (!modeFeatures.dashboard) {
    return (
      <div className="section">
        <div className="text-center">
          This feature is only available in server mode.
        </div>
      </div>
    );
  }

  if (page) {
    panels = page.panels;
  } else {
    return <Loading />;
  }

  if (!panels) {
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
      {!isExport && (
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
            value={String(page.refreshPeriod)}
          >
            <option value={String(60 * 60)}>6 hour</option>
            <option value={String(60 * 60)}>1 hour</option>
            <option value={String(60 * 15)}>15 minutes</option>
            <option value={String(60 * 5)}>5 minutes</option>
            <option value="60">1 minute</option>
          </Select>
        </div>
      )}
      {page.panels.map((panel) => (
        <ErrorBoundary key={panel.id}>
          <Panel panel={panel} />
        </ErrorBoundary>
      ))}
    </div>
  );
}
