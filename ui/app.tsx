import * as React from 'react';
import { MODE, MODE_FEATURES } from '../shared/constants';
import { LANGUAGES } from '../shared/languages';
import '../shared/polyfill';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loading } from './components/Loading';
import { Version } from './components/Version';
import { ConnectorList } from './ConnectorList';
import { Header, loadDefaultProject } from './Header';
import { MakeSelectProject } from './MakeSelectProject';
import { Navigation } from './Navigation';
import { PageList } from './PageList';
import { ServerList } from './ServerList';
import { Settings, SettingsContext, useSettings } from './Settings';
import { useShortcuts } from './shortcuts';
import { Sidebar } from './Sidebar';
import { ProjectContext, useProjectState } from './state';
import { Updates } from './Updates';
import { UrlStateContext, useUrlState } from './urlState';

if (MODE === 'browser') {
  Object.values(LANGUAGES).map(function processLanguageInit(l) {
    if (l.inMemoryInit) {
      // These can be really big, so run it out of band
      setTimeout(function () {
        l.inMemoryInit();
      });
    }
  });
}

export function App() {
  const [urlState, setUrlState] = useUrlState();
  const [state, crud] = useProjectState(urlState.projectId, urlState.page);
  React.useEffect(
    function setDocumentTitle() {
      if (state && state.projectName) {
        if (urlState.view === 'settings') {
          document.title = 'DataStation Settings';
        } else {
          document.title = state.projectName;
        }
      }
    },
    [state && state.projectName]
  );

  const [settings, setSettings] = useSettings();
  React.useEffect(
    function updateBodyBackground() {
      if (settings) {
        document.body.className = settings.theme;
      }
    },
    [settings && settings.theme]
  );

  useShortcuts(urlState, setUrlState);

  // Load default project in browser mode
  const [loadingDefault, setLoadingDefault] = React.useState(false);
  React.useEffect(() => {
    if (
      MODE_FEATURES.useDefaultProject &&
      !urlState.projectId &&
      !loadingDefault
    ) {
      setLoadingDefault(true);
      loadDefaultProject();
      setLoadingDefault(false);
    }
  });

  let main = <Loading />;
  if (!state || !settings) {
    if (urlState.projectId || !settings) {
      return <Loading />;
    }

    if (!MODE_FEATURES.useDefaultProject) {
      main = <MakeSelectProject />;
    }
  } else if (urlState.view === 'settings') {
    main = <Settings />;
  } else {
    // This allows us to render the sidebar in tests where we
    // prepopulate connectors and servers
    const hasSidebar =
      Boolean(
        MODE_FEATURES.connectors ||
          state.connectors?.length ||
          state.servers?.length
      ) && urlState.view === 'editor';

    main = (
      <React.Fragment>
        {urlState.projectId && hasSidebar && (
          <Sidebar>
            <ConnectorList
              state={state}
              updateConnector={crud.updateConnector}
              deleteConnector={crud.deleteConnector}
            />
            <ServerList
              state={state}
              updateServer={crud.updateServer}
              deleteServer={crud.deleteServer}
            />
            <ErrorBoundary>
              <Updates />
            </ErrorBoundary>
          </Sidebar>
        )}
        <div className="main-body">
          <PageList
            state={state}
            updatePage={crud.updatePage}
            deletePage={crud.deletePage}
            updatePanel={crud.updatePanel}
            pageIndex={urlState.page % (state.pages || []).length}
            setPageIndex={(i) => setUrlState({ page: i, view: 'editor' })}
          />
          <Version />
        </div>
      </React.Fragment>
    );
  }

  return (
    <ProjectContext.Provider value={{ state, crud }}>
      <UrlStateContext.Provider
        value={{ state: urlState, setState: setUrlState }}
      >
        <SettingsContext.Provider
          value={{ state: settings, setState: setSettings }}
        >
          <div className={`app app--${MODE} app--${settings.theme}`}>
            {MODE_FEATURES.appHeader && <Header />}
            <main className={'view-' + (urlState.view || 'editor')}>
              <Navigation />
              {main}
            </main>
          </div>
        </SettingsContext.Provider>
      </UrlStateContext.Provider>
    </ProjectContext.Provider>
  );
}
