import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { APP_NAME, IS_DESKTOP_APP, MODE } from './constants';
import { evalPanel, Panel, PanelResult } from './Panel';
import { ProjectStore, ProjectState } from './ProjectStore';

function useProjectState(projectId: string, store: ProjectStore): [ProjectState, (d: ProjectState) => void] {
  const [state, setProjectState] = React.useState<ProjectState>(null);

  function setState(newState: ProjectState) {
    store.update(projectId, newState);
    setProjectState(newState);
  }

  let [ready, setReady] = React.useState(false);
  // Run init once
  React.useEffect(() => {
    async function init() {
      await store.init();
      setReady(true);
    }

    init();
  });

  // Re-read state when projectId changes
  React.useEffect(() => {
    if (!ready) {
      return;
    }

    setProjectState(store.get(projectId));
  }, [projectId, ready]);

  return [state, setState];
}

function App() {
  // TODO: projectId needs to come from opened project.
  const [projectId, setProjectId] = React.useState('default');

  const store = ProjectStore.make(MODE);
  const [state, setState] = useProjectState(projectId, store);

  const [rows, setRows] = React.useState<Array<PanelResult>>([]);
  if (!state) {
    // Loading
    return null;
  }

  const page = state.pages[state.currentPage];
  async function reevalPanel(panelIndex: number) {
    try {
      const r = await evalPanel(page, panelIndex, rows);
      rows[panelIndex] = { lastRun: new Date(), value: r };
    } catch (e) {
      rows[panelIndex] = { lastRun: new Date(), exception: e.stack };
    } finally {
      setRows({ ...rows });
    }
  }

  function movePanel(from: number, to: number) {
    const panel = page.panels[from];
    page.panels.splice(from, 1);
    page.panels.splice(to, 0, panel);
    setState({ ...state });
  }

  function removePanel(at: number) {
    page.panels.splice(at, 1);
    setState({ ...state });
  }

  function updatePanel(panelIndex: number) {
    return (panel) => {
      page.panels[panelIndex][page.panels[panelIndex].type] = panel;
      setState({ ...state });
    };
  }

  return (
    <div>
      {!IS_DESKTOP_APP && (
        <header>
          <span className="logo">{APP_NAME}</span>
          <span
            contentEditable="true"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setState({ ...state, projectName: e.target.value });
            }}
          >
            {state.projectName}
          </span>
        </header>
      )}
      <main>
        <div className="section datasources">
          <div className="title">Datasources</div>
          {state.datasources.map((datasource: any) => (
            <div className="datasource">
              <span className="datasource-type">{datasource.type}</span>
              <span
                className="datasource-name"
                contentEditable="true"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  datasource.name = e.target.value;
                  setState({ ...state });
                }}
              >
                {datasource.name}
              </span>
            </div>
          ))}
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              state.datasources.push({ name: 'Untitled datasource' });
              setState({ ...state, currentPage: state.pages.length - 1 });
            }}
          >
            New Datasource
          </button>
        </div>
        <div className="section panels">
          <div className="section-title">
            <span
              contentEditable="true"
              className="page-name page-name--current"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                page.name = e.target.value;
                setState({ ...state });
              }}
            >
              {page.name}
            </span>
            {state.pages.map((page: ProjectPage, i: number) =>
              i === state.currentPage ? undefined : (
                <button
                  className="button page-name"
                  type="button"
                  onClick={() => setState({ ...state, currentPage: i })}
                >
                  {page.name}
                </button>
              )
            )}
            <button
              type="button"
              className="button button--primary flex-right"
              onClick={() => {
                state.pages.push({ name: 'Untitled page', panels: [] });
                setState({ ...state, currentPage: state.pages.length - 1 });
              }}
            >
              New Page
            </button>
          </div>
          <div>
            {page.panels.map((panel, panelIndex) => (
              <Panel
                panel={panel}
                updatePanel={updatePanel(panelIndex)}
                rows={rows}
                reevalPanel={reevalPanel}
                panelIndex={panelIndex}
                movePanel={movePanel}
                removePanel={removePanel}
                panelCount={page.panels.length}
              />
            ))}
          </div>
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              page.panels.push({
                name: 'Untitled panel',
                type: 'literal',
                literal: {},
              });
              setState({ ...state });
            }}
          >
            New Panel
          </button>
        </div>
      </main>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
