import * as pako from 'pako';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {
  APP_NAME,
  MODE,
  MODE_FEATURES,
  SITE_ROOT,
  VERSION,
} from '../shared/constants';
import '../shared/polyfill';
import {
  ConnectorInfo,
  DEFAULT_PROJECT,
  ProjectPage,
  ProjectState,
  ServerInfo,
} from '../shared/state';
import { asyncRPC } from './asyncRPC';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';
import { Connectors } from './Connectors';
import { ErrorBoundary } from './ErrorBoundary';
import { Pages } from './Pages';
import { makeStore, ProjectContext, ProjectStore } from './ProjectStore';
import { Servers } from './Servers';
import { Sidebar } from './Sidebar';
import { Updates } from './Updates';

// Load pyodide on startup if in browser app
window.addEventListener('load', function () {
  if (MODE !== 'browser') {
    return;
  }

  const pyodide = document.createElement('script');
  pyodide.src = 'https://cdn.jsdelivr.net/pyodide/v0.18.0/full/pyodide.js';
  document.body.appendChild(pyodide);

  pyodide.onload = async function () {
    (window as any).pyodide = await (window as any).loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.18.0/full/',
    });
  };
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

const shareStateCache: {
  state: undefined | ProjectState;
  checked: boolean;
} = {
  state: undefined,
  checked: false,
};

function getShareState(): undefined | ProjectState {
  if (shareStateCache.checked) {
    return shareStateCache.state;
  }

  shareStateCache.checked = true;
  const shareState = getQueryParameter('share');
  if (shareState) {
    // TODO: this can be more efficient than calling split
    const intArray = Uint8Array.from(
      shareState.split(',').map((i) => parseInt(i))
    );
    const uncompressed = JSON.parse(pako.inflate(intArray, { to: 'string' }));
    shareStateCache.state = ProjectState.fromJSON(uncompressed);
  }

  return shareStateCache.state;
}

function useProjectState(
  projectId: string,
  store: ProjectStore | null,
  shareState: ProjectState | undefined
): [ProjectState, (d: ProjectState) => void] {
  const [state, setProjectState] = React.useState<ProjectState>(null);

  const [previousProjectId, setPreviousProjectId] = React.useState('');
  const isNewProject =
    projectId && previousProjectId === '' && projectId !== previousProjectId;

  function setState(newState: ProjectState, addToRestoreBuffer = true) {
    store.update(projectId, newState, addToRestoreBuffer);
    setProjectState(newState);
  }

  const isDefault =
    MODE_FEATURES.useDefaultProject &&
    projectId === DEFAULT_PROJECT.projectName;

  React.useEffect(() => {}, []);

  // Set up undo mechanism
  React.useEffect(() => {
    function handleUndo(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        const prevState = store.undo(projectId);
        if (prevState) {
          setState(prevState, false);
        }
      }
    }

    document.addEventListener('keydown', handleUndo);
    return () => document.removeEventListener('keydown', handleUndo);
  }, []);

  // Re-read state when projectId changes
  React.useEffect(() => {
    if (shareState) {
      setProjectState(shareState);
      return;
    }

    async function fetch() {
      let state;
      try {
        let rawState = await store.get(projectId);
        if (!rawState && (!isNewProject || isDefault)) {
          throw new Error();
        } else {
          state = ProjectState.fromJSON(rawState);
        }
      } catch (e) {
        if (isDefault) {
          state = DEFAULT_PROJECT;
        } else {
          console.error(e);
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

function App() {
  const shareState = getShareState();
  const [projectId, setProjectIdInternal] = React.useState(
    (shareState && shareState.id) ||
      getQueryParameter('project') ||
      (MODE_FEATURES.useDefaultProject ? DEFAULT_PROJECT.projectName : '')
  );
  (window as any).projectId = projectId;

  function setProjectId(projectId: string) {
    setProjectIdInternal(projectId);
    return asyncRPC<{ lastProject: string }, void, void>(
      'updateSettings',
      null,
      { lastProject: projectId }
    );
  }

  const [state, updateProjectState] = useProjectState(
    projectId,
    store,
    shareState
  );

  const currentPageKey = 'currentPage:' + projectId;
  const [currentPage, _setCurrentPage] = React.useState(
    +localStorage.getItem(currentPageKey) || 0
  );
  function setCurrentPage(p: number) {
    localStorage.setItem(currentPageKey, String(p) || '0');
    return _setCurrentPage(p);
  }

  const [shareURL, setShareURL] = React.useState('');

  function computeShareURL() {
    const domain =
      window.location.protocol +
      '//' +
      window.location.hostname +
      (window.location.port ? ':' + window.location.port : '');
    const json = JSON.stringify(state);
    const compressed = pako.deflate(json, { to: 'string' });
    setShareURL(domain + '/?share=' + compressed);
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

  if (!state && projectId) {
    return (
      <div className="loading">
        Loading...
        <span id="spin"></span>
      </div>
    );
  }

  function updatePage(page: ProjectPage) {
    state.pages[currentPage] = page;
    updateProjectState({ ...state });
  }

  function addPage(page: ProjectPage) {
    state.pages.push(page);
    updateProjectState({ ...state });
  }

  function deletePage(at: number) {
    state.pages.splice(at, 1);
    updateProjectState({ ...state });
  }

  function updateConnector(dcIndex: number, dc: ConnectorInfo) {
    state.connectors[dcIndex] = dc;
    updateProjectState({ ...state });
  }

  function addConnector(dc: ConnectorInfo) {
    state.connectors.push(dc);
    updateProjectState({ ...state });
  }

  function deleteConnector(at: number) {
    state.connectors.splice(at, 1);
    updateProjectState({ ...state });
  }

  function updateServer(dcIndex: number, dc: ServerInfo) {
    state.servers[dcIndex] = dc;
    updateProjectState({ ...state });
  }

  function addServer(dc: ServerInfo) {
    state.servers.push(dc);
    updateProjectState({ ...state });
  }

  function deleteServer(at: number) {
    state.servers.splice(at, 1);
    updateProjectState({ ...state });
  }

  async function openProject() {
    await asyncRPC<void, void, void>('openProject');
    window.close();
  }

  return (
    <ProjectContext.Provider value={state}>
      <div className={`app app--${MODE}`}>
        {MODE_FEATURES.appHeader && (
          <header>
            <div className="vertical-align-center">
              <span className="logo">{APP_NAME}</span>
              <div className="flex-right vertical-align-center">
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
                {MODE_FEATURES.shareProject && (
                  <div className="share">
                    <Button onClick={() => computeShareURL()}>Share</Button>
                    <div className="share-details">
                      <p>This URL contains the entire project state.</p>
                      <p>
                        Project data is not stored on a server. But if you do
                        use this URL, the data encoded in the URL will appear in
                        DataStation web server access logs.
                      </p>
                      <p>
                        If you make changes, you will need to click "Share"
                        again to get a new URL.
                      </p>
                      <Input readOnly value={shareURL} onChange={() => {}} />
                      <p>
                        <a href="https://tinyurl.com/app">TinyURL</a> is a good
                        service for shortening these URLs correctly, some other
                        systems break the URL.
                      </p>
                    </div>
                  </div>
                )}
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
                <a href={`${SITE_ROOT}/#online-environment`} target="_blank">
                  About
                </a>
              </div>
            </div>
          </header>
        )}
        <main>
          {projectId && MODE_FEATURES.connectors && (
            <Sidebar>
              <Connectors
                state={state}
                updateConnector={updateConnector}
                addConnector={addConnector}
                deleteConnector={deleteConnector}
              />
              <Servers
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
                    onClick={() => setProjectId(projectNameTmp)}
                  >
                    {projectNameTmp ? 'Go!' : 'Pick a name'}
                  </Button>
                </div>
                <div className="project-existing">
                  <p>Or open an existing project.</p>
                  <div className="form-row">
                    <Button onClick={openProject}>Open</Button>
                  </div>
                </div>
              </div>
            ) : (
              <Pages
                state={state}
                updatePage={updatePage}
                addPage={addPage}
                deletePage={deletePage}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
              />
            )}
            <div className="version">Version {VERSION}</div>
          </div>
        </main>
      </div>
    </ProjectContext.Provider>
  );
}

// SOURCE: https://stackoverflow.com/a/7995898/1507139
const isMobile = navigator.userAgent.match(
  /(iPad)|(iPhone)|(iPod)|(android)|(webOS)/i
);
if (!isMobile) {
  ReactDOM.render(<App />, document.getElementById('root'));
} else {
  document.getElementById('root').innerHTML =
    'Please use a desktop web browser to view this app.';
}
