import { ProjectPage } from '@datastation/shared/state';
import React from 'react';
import { Button } from '../components/Button';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Select } from '../components/Select';
import { makeReevalPanel } from '../PageList';
import { ProjectContext } from '../ProjectStore';
import { UrlStateContext } from '../urlState';
import { Panel } from './Panel';

const IS_EXPORT = Boolean((window as any).DATASTATION_IS_EXPORT);

export function Dashboard() {
  const {
    state: { page: pageIndex, refreshPeriod },
    setState: setUrlState,
  } = React.useContext(UrlStateContext);
  const { state: projectState, setState: setProjectState } =
    React.useContext(ProjectContext);
  const { panels, name } = projectState.pages[pageIndex];

  const reevalPanel = makeReevalPanel(
    projectState.pages[pageIndex],
    projectState,
    (p: ProjectPage) => {
      projectState.pages[pageIndex] = p;
      setProjectState(projectState);
    }
  );

  async function evalAll() {
    for (let panel of panels) {
      await reevalPanel(panel.id);
    }
  }

  React.useEffect(() => {
    let done = false;
    let i: ReturnType<typeof setTimeout> = null;
    if (IS_EXPORT) {
      return;
    }

    async function loop() {
      while (!done) {
        clearTimeout(i);
        await new Promise<void>((resolve, reject) => {
          try {
            i = setTimeout(() => {
              try {
                evalAll();
                resolve();
              } catch (e) {
                reject(e);
              }
            }, (+refreshPeriod || 60) * 1000);
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
  }, [refreshPeriod, panels.map((p) => p.id).join(',')]);

  return (
    <div className="main-body">
      <div className="section">
        <div className="vertical-align-center">
          <div className="section-title">
            {name}
            {!IS_EXPORT && (
              <span title="Enter editor mode">
                <Button icon onClick={() => setUrlState({ view: 'editor' })}>
                  pencil
                </Button>
              </span>
            )}
          </div>
          {!IS_EXPORT && (
            <div className="flex-right">
              <Select
                label="Refresh every"
                onChange={(v: string) => setUrlState({ refreshPeriod: +v })}
                value={String(+refreshPeriod || 60)}
              >
                <option value="30">30 seconds</option>
                <option value="60">1 minute</option>
                <option value={String(60 * 5)}>5 minutes</option>
                <option value={String(60 * 15)}>15 minutes</option>
                <option value={String(60 * 60)}>1 hour</option>
              </Select>
            </div>
          )}
        </div>
        {panels.map((panel) => (
          <ErrorBoundary key={panel.id}>
            <Panel panel={panel} />
          </ErrorBoundary>
        ))}
      </div>
    </div>
  );
}
