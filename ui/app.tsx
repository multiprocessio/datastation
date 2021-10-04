import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import * as React from 'react';
import {
  APP_NAME,
  MODE,
  MODE_FEATURES,
  SITE_ROOT,
  VERSION,
} from '../shared/constants';
import { LANGUAGES } from '../shared/languages';
import log from '../shared/log';
import '../shared/polyfill';
import {
  GetProjectsRequest,
  GetProjectsResponse,
  MakeProjectRequest,
  MakeProjectResponse,
  OpenProjectRequest,
  OpenProjectResponse,
} from '../shared/rpc';
import {
  ConnectorInfo,
  DEFAULT_PROJECT,
  ProjectPage,
  ProjectState,
  ServerInfo,
} from '../shared/state';
import { asyncRPC } from './asyncRPC';
import { Alert } from './components/Alert';
import { Button } from './components/Button';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Input } from './components/Input';
import { ConnectorList } from './ConnectorList';
import { PageList } from './PageList';
import { makeStore, ProjectContext, ProjectStore } from './ProjectStore';
import { ServerList } from './ServerList';
import { Sidebar } from './Sidebar';
import { Updates } from './Updates';

Object.values(LANGUAGES).map((l) => {
  if (l.inMemoryInit) {
    l.inMemoryInit();
  }
});

function getQueryParameter(param: String) {
  const query = window.location.search.substring(1);
  const vars = query.split('&');

  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');
    if (pair[0] === param) {
      return decodeURIComponent(pair[1]);
    }
  }

  return '';
}

function useProjectState(
  projectId: string,
  store: ProjectStore | null
): [ProjectState, (d: ProjectState) => void] {
  const [state, setProjectState] = React.useState<ProjectState>(null);

  const [previousProjectId, setPreviousProjectId] = React.useState('');
  const isNewProject =
    projectId && previousProjectId === '' && projectId !== previousProjectId;

  function setState(newState: ProjectState, addToRestoreBuffer = true) {
    store.update(projectId, newState, addToRestoreBuffer);
    const c = { ...newState };
    Object.setPrototypeOf(c, ProjectState.prototype);
    setProjectState(c);
  }

  const isDefault =
    MODE_FEATURES.useDefaultProject &&
    projectId === DEFAULT_PROJECT.projectName;

  // Set up undo mechanism
  /* React.useEffect(() => {
   *   function handleUndo(e: KeyboardEvent) {
   *     if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
   *       const prevState = store.undo(projectId);
   *       if (prevState) {
   *         setState(prevState, false);
   *       }
   *     }
   *   }

   *   document.addEventListener('keydown', handleUndo);
   *   return () => document.removeEventListener('keydown', handleUndo);
   * }, []); */

  // Re-read state when projectId changes
  React.useEffect(() => {
    async function fetch() {
      let state;
      try {
        let rawState = await store.get(projectId);
        if (!rawState && (!isNewProject || isDefault)) {
          throw new Error();
        } else {
          state = await ProjectState.fromJSON(rawState);
        }
      } catch (e) {
        if (isDefault && e.message === '') {
          state = DEFAULT_PROJECT;
        } else {
          log.error(e);
        }
      }

      state.projectName = projectId;
      state.lastVersion = VERSION;
      setProjectState(state);
      setPreviousProjectId(projectId);
    }

    if (projectId) {
      fetch();
    }
  }, [projectId]);

  return [state, setState];
}

const store = makeStore(MODE);

export function App() {
  const requestedProjectId = getQueryParameter('project');
  const [projectId, setProjectId] = React.useState(
    requestedProjectId ||
      (MODE_FEATURES.useDefaultProject ? DEFAULT_PROJECT.projectName : '')
  );
  (window as any).projectId = projectId;
  React.useEffect(() => {
    if (!requestedProjectId && projectId && MODE !== 'browser') {
      window.location.href = window.location.pathname + '?project=' + projectId;
    }
  }, [requestedProjectId, projectId]);

  const [makeProjectError, setMakeProjectError] = React.useState('');
  async function makeProject(projectId: string) {
    try {
      await asyncRPC<MakeProjectRequest, MakeProjectResponse>('makeProject', {
        projectId,
      });
      setProjectId(projectId);
    } catch (e) {
      setMakeProjectError(e.message);
    }
  }

  const [state, updateProjectState] = useProjectState(projectId, store);

  const currentPageKey = 'currentPage:' + projectId;
  const [currentPage, _setCurrentPage] = React.useState(
    +localStorage.getItem(currentPageKey) || 0
  );
  function setCurrentPage(p: number) {
    localStorage.setItem(currentPageKey, String(p) || '0');
    return _setCurrentPage(p);
  }

  React.useEffect(() => {
    if (state && state.projectName) {
      document.title = state.projectName;
    }

    // Set body overflow once on init
    if (MODE_FEATURES.noBodyYOverflow) {
      document.body.style.overflowY = 'hidden';
    }
  }, [state && state.projectName]);

  const [projectNameTmp, setProjectNameTmp] = React.useState('');

  const [headerHeight, setHeaderHeightInternal] = React.useState(0);
  const setHeaderHeight = React.useCallback((e: HTMLElement) => {
    if (!e) {
      return;
    }

    setHeaderHeightInternal(e.offsetHeight);
  }, []);

  const [projects, setProjects] = React.useState<GetProjectsResponse | null>(
    null
  );
  React.useEffect(() => {
    async function load() {
      const projects = await asyncRPC<GetProjectsRequest, GetProjectsResponse>(
        'getProjects',
        null
      );
      setProjects(projects);
    }

    if (MODE === 'server' && !projects) {
      load();
    }
  }, []);

  if ((!state && projectId) || (MODE === 'server' && !projects)) {
    return (
      <div className="loading">
        Loading...
        <span id="spin"></span>
      </div>
    );
  }

  function updatePage(page: ProjectPage) {
    state.pages[currentPage] = page;
    updateProjectState(state);
  }

  function addPage(page: ProjectPage) {
    state.pages.push(page);
    updateProjectState(state);
  }

  function deletePage(at: number) {
    state.pages.splice(at, 1);
    updateProjectState(state);
  }

  function updateConnector(dcIndex: number, dc: ConnectorInfo) {
    state.connectors[dcIndex] = dc;
    updateProjectState(state);
  }

  function addConnector(dc: ConnectorInfo) {
    state.connectors.push(dc);
    updateProjectState(state);
  }

  function deleteConnector(at: number) {
    state.connectors.splice(at, 1);
    updateProjectState(state);
  }

  function updateServer(dcIndex: number, dc: ServerInfo) {
    state.servers[dcIndex] = dc;
    updateProjectState(state);
  }

  function addServer(dc: ServerInfo) {
    state.servers.push(dc);
    updateProjectState(state);
  }

  function deleteServer(at: number) {
    state.servers.splice(at, 1);
    updateProjectState(state);
  }

  async function openProject() {
    await asyncRPC<OpenProjectRequest, OpenProjectResponse>(
      'openProject',
      null
    );
    window.close();
  }

  return (
    <ProjectContext.Provider value={state}>
      <div className={`app app--${MODE}`}>
        {MODE_FEATURES.appHeader && (
          <header ref={setHeaderHeight}>
            <div className="vertical-align-center">
              <span className="logo">{APP_NAME}</span>
              <div className="flex-right vertical-align-center">
                {MODE === 'browser' ? (
                  <React.Fragment>
                    <span title="Drop all state and load a sample project.">
                      <Button
                        onClick={() => {
                          updateProjectState(DEFAULT_PROJECT);
                          window.location.reload();
                        }}
                      >
                        Reset
                      </Button>
                    </span>
                    <a
                      href="https://github.com/multiprocessio/datastation"
                      target="_blank"
                    >
                      <iframe
                        src="https://ghbtns.com/github-btn.html?user=multiprocessio&repo=datastation&type=star&count=true&size=medium"
                        frameBorder="0"
                        scrolling="0"
                        width="80"
                        height="20"
                        title="GitHub"
                      ></iframe>
                    </a>
                    <a
                      href={`${SITE_ROOT}/#online-environment`}
                      target="_blank"
                    >
                      About
                    </a>
                  </React.Fragment>
                ) : (
                  <span>{projectId}</span>
                )}
              </div>
            </div>
          </header>
        )}
        <main
          style={{
            marginTop: headerHeight,
            height: `calc(100% - ${headerHeight}px)`,
          }}
        >
          {projectId && MODE_FEATURES.connectors && (
            <Sidebar>
              <ConnectorList
                state={state}
                updateConnector={updateConnector}
                addConnector={addConnector}
                deleteConnector={deleteConnector}
              />
              <ServerList
                state={state}
                updateServer={updateServer}
                addServer={addServer}
                deleteServer={deleteServer}
              />
              <ErrorBoundary>
                <Updates />
              </ErrorBoundary>
            </Sidebar>
          )}
          <div className="main-body">
            {!projectId ? (
              <div className="project-name">
                <h1>New Project</h1>
                <p>Pick a name for this project to get started.</p>
                <div className="form-row">
                  <Input
                    value={projectNameTmp}
                    label="Project name"
                    onChange={(v) => setProjectNameTmp(v)}
                  />
                </div>
                <div className="form-row">
                  <Button
                    type="primary"
                    disabled={!projectNameTmp}
                    onClick={() => makeProject(projectNameTmp)}
                  >
                    {projectNameTmp ? 'Go!' : 'Pick a name'}
                  </Button>
                </div>
                {makeProjectError && (
                  <Alert type="error" children={makeProjectError} />
                )}
                {MODE === 'desktop' && (
                  <div className="project-existing">
                    <p>Or open an existing project.</p>
                    <div className="form-row">
                      <Button onClick={openProject}>Open</Button>
                    </div>
                  </div>
                )}
                {MODE === 'server' && projects.length ? (
                  <div className="project-existing">
                    <p>Or open an existing project.</p>
                    {projects.map(({ name, createdAt }) => (
                      <div className="form-row">
                        <h3>{name}</h3>
                        <div>
                          Created{' '}
                          {formatDistanceToNow(new Date(createdAt), {
                            addSuffix: true,
                          })}
                        </div>
                        <a href={'/?project=' + name}>Open</a>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <PageList
                state={state}
                updatePage={updatePage}
                addPage={addPage}
                deletePage={deletePage}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
              />
            )}
            <div className="version">{VERSION}</div>
          </div>
        </main>
      </div>
    </ProjectContext.Provider>
  );
}
