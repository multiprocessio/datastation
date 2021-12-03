import * as React from 'react';
import { MODE, MODE_FEATURES, VERSION } from '../shared/constants';
import { LANGUAGES } from '../shared/languages';
import log from '../shared/log';
import '../shared/polyfill';
import {
  ConnectorInfo,
  DEFAULT_PROJECT,
  ProjectPage,
  ProjectState,
  ServerInfo,
} from '../shared/state';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loading } from './components/Loading';
import { Version } from './components/Version';
import { ConnectorList } from './ConnectorList';
import { Header } from './Header';
import { MakeSelectProject } from './MakeSelectProject';
import { PageList } from './PageList';
import { makeStore, ProjectContext, ProjectStore } from './ProjectStore';
import { ServerList } from './ServerList';
import { SettingsContext, useSettings } from './settings';
import { Sidebar } from './Sidebar';
import { Updates } from './Updates';
import { UrlStateContext, useUrlState } from './urlState';

if (MODE === 'browser') {
  Object.values(LANGUAGES).map(function processLanguageInit(l) {
    if (l.inMemoryInit) {
      // These can be really big, so run it out of band
      setTimeout(function () {
        l.inMemoryInit();
      }, 0);
    }
  });
}

function useProjectState(
  projectId: string,
  store: ProjectStore | null
): [ProjectState, (d: ProjectState) => void] {
  const [state, setProjectState] = React.useState<ProjectState>(null);

  const setState = React.useCallback(
    function setState(newState: ProjectState, addToRestoreBuffer = true) {
      store.update(projectId, newState, addToRestoreBuffer);
      const c = { ...newState };
      Object.setPrototypeOf(c, ProjectState.prototype);
      setProjectState(c);
    },
    [projectId, store, setProjectState]
  );

  React.useEffect(
    function reReadStateWhenProjectIdChanges() {
      async function fetch() {
        let state;
        try {
          let rawState = await store.get(projectId);
          state = await ProjectState.fromJSON(rawState);
        } catch (e) {
          log.error(e);
        }

        state.projectName = projectId;
        state.lastVersion = VERSION;
        setProjectState(state);
      }

      if (projectId) {
        fetch();
      }
    },
    [projectId]
  );

  return [state, setState];
}

const store = makeStore(MODE);

export function App() {
  const [urlState, setUrlState] = useUrlState();
  const [state, setProjectState] = useProjectState(urlState.projectId, store);
  const [loadedDefault, setLoadedDefault] = React.useState(false);
  React.useEffect(
    function loadDefaultProject() {
      if (
        !urlState.projectId &&
        MODE_FEATURES.useDefaultProject &&
        !loadedDefault
      ) {
        setLoadedDefault(true);
        setUrlState({ projectId: DEFAULT_PROJECT.projectName });
        setProjectState(DEFAULT_PROJECT);
      }
    },
    [urlState.projectId, loadedDefault]
  );

  React.useEffect(
    function setDocumentTitle() {
      if (state && state.projectName) {
        document.title = state.projectName;
      }
    },
    [state && state.projectName]
  );

  const [settings, setSettings] = useSettings();

  function updatePage(page: ProjectPage) {
    state.pages[urlState.page] = page;
    setProjectState(state);
  }

  function addPage(page: ProjectPage) {
    state.pages.push(page);
    setProjectState(state);
  }

  function deletePage(at: number) {
    state.pages.splice(at, 1);
    setProjectState(state);
  }

  function updateConnector(id: string, dc: ConnectorInfo) {
    const index = (state.connectors || []).findIndex((c) => c.id === id);
    if (index === -1) {
      state.connectors.push(dc);
      return;
    }
    state.connectors[index] = dc;
    setProjectState(state);
  }

  function addConnector(dc: ConnectorInfo) {
    state.connectors.push(dc);
    setProjectState(state);
  }

  function deleteConnector(id: string) {
    const at = (state.connectors || []).findIndex((c) => c.id === id);
    if (at === -1) {
      return;
    }
    state.connectors.splice(at, 1);
    setProjectState(state);
  }

  function updateServer(id: string, dc: ServerInfo) {
    const index = (state.servers || []).findIndex((c) => c.id === id);
    if (index === -1) {
      state.servers.push(dc);
      return;
    }
    state.servers[index] = dc;
    setProjectState(state);
  }

  function addServer(dc: ServerInfo) {
    state.servers.push(dc);
    setProjectState(state);
  }

  function deleteServer(id: string) {
    const at = (state.servers || []).findIndex((c) => c.id === id);
    if (at === -1) {
      return;
    }
    state.servers.splice(at, 1);
    setProjectState(state);
  }

  let main = <Loading />;
  if (!state || !settings) {
    if (urlState.projectId || !settings) {
      return <Loading />;
    }

    if (!MODE_FEATURES.useDefaultProject) {
      main = <MakeSelectProject />;
    }
  } else {
    // This allows us to render the sidebar in tests where we
    // prepopulate connectors and servers
    const hasSidebar = Boolean(
      MODE_FEATURES.connectors ||
        state.connectors?.length ||
        state.servers?.length
    );

    main = (
      <React.Fragment>
        {urlState.projectId && hasSidebar && (
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
          <PageList
            state={state}
            updatePage={updatePage}
            addPage={addPage}
            deletePage={deletePage}
            pageIndex={urlState.page}
            setPageIndex={(i) => setUrlState({ page: i, view: 'editor' })}
          />
          <Version />
        </div>
      </React.Fragment>
    );
  }

  return (
    <ProjectContext.Provider value={{ state, setState: setProjectState }}>
      <UrlStateContext.Provider
        value={{ state: urlState, setState: setUrlState }}
      >
        <SettingsContext.Provider
          value={{ state: settings, setState: setSettings }}
        >
          <div className={`app app--${MODE} app--${settings.theme}`}>
            <div>
              {MODE_FEATURES.appHeader && <Header />}
              <main className={'view-' + (urlState.view || 'editor')}>
                {main}
              </main>
            </div>
          </div>
        </SettingsContext.Provider>
      </UrlStateContext.Provider>
    </ProjectContext.Provider>
  );
}
