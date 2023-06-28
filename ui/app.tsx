import {
  IconCalendar,
  IconCircleX,
  IconCode,
  IconFiles,
  IconHelp,
  IconLayoutDashboard,
  IconSettings,
  Icon as TablerIcon,
} from '@tabler/icons';
import * as React from 'react';
import { MODE, MODE_FEATURES } from '../shared/constants';
import { LANGUAGES } from '../shared/languages';
import '../shared/polyfill';
import { Settings as SettingsT } from '../shared/settings';
import { Editor } from './Editor';
import { Footer } from './Footer';
import { Header, loadDefaultProject } from './Header';
import { Help } from './Help';
import { MakeSelectProject } from './MakeSelectProject';
import { Navigation } from './Navigation';
import { NotFound } from './NotFound';
import { Settings, SettingsContext, useSettings } from './Settings';
import { Button } from './components/Button';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loading } from './components/Loading';
import { useShortcuts } from './shortcuts';
import { ProjectContext, useProjectState } from './state';
import { DefaultView, UrlStateContext, useUrlState } from './urlState';

if (MODE === 'browser') {
  Object.values(LANGUAGES).map(function processLanguageInit(l) {
    if (l.inMemoryInit) {
      // These can be really big, so run it out of band
      setTimeout(function() {
        l.inMemoryInit();
      });
    }
  });
}

type Routes = Array<{
  endpoint: string;
  view: React.FC;
  title: string;
  icon: TablerIcon;
}>;

export function defaultRoutes(): Routes {
  function makeServerRequired(title: string) {
    return function ServerRequired() {
      return (
        <div className="main-body">
          <div className="card card--center project-name">
            <h1>{title}</h1>
            <p>
              Must be running the DataStation server to access this feature.
            </p>
          </div>
          <Footer />
        </div>
      );
    };
  }

  return [
    {
      endpoint: 'editor',
      view: Editor,
      title: 'Editor',
      icon: IconCode,
    },
    {
      endpoint: 'dashboard',
      view: makeServerRequired('Dashboards'),
      title: 'Dashboards',
      icon: IconLayoutDashboard,
    },
    {
      endpoint: 'exports',
      view: makeServerRequired('Exports'),
      title: 'Exports',
      icon: IconCalendar,
    },
    MODE === 'server'
      ? {
        endpoint: 'projects',
        view: MakeSelectProject,
        title: 'Switch project',
        icon: IconFiles,
      }
      : null,
    {
      endpoint: 'settings',
      view: Settings,
      title: 'Settings',
      icon: IconSettings,
    },
    {
      endpoint: 'help',
      view: Help,
      title: 'Help',
      icon: IconHelp,
    },
  ].filter(Boolean);
}

/* function Aug2022Survey({
 *   settings,
 *   setSettings,
 * }: {
 *   settings: SettingsT;
 *   setSettings: (s: Partial<SettingsT>) => void;
 * }) {
 *   if (!settings.surveyAug2022) {
 *     return null;
 *   }
 * 
 *   return (
 *     <div className="banner vertical-align-center">
 *       <Button
 *         icon
 *         onClick={() => setSettings({ ...settings, surveyAug2022: false })}
 *       >
 *         <IconCircleX />
 *       </Button>
 *       Help us out: take a quick
 *       <a
 *         target="_blank"
 *         href="https://docs.google.com/forms/d/e/1FAIpQLSdNhU5k3FsIkcea_CTPVrmJ45k0czRz60XqLmBVUE5TjaT_jg/viewform"
 *       >
 *         user survey
 *       </a>
 *       !
 *     </div>
 *   );
 * }
 *  */
export function App<T extends DefaultView = DefaultView>({
  routes,
}: {
  routes: Routes;
}) {
  const [urlState, setUrlState] = useUrlState<T>();
  const [state, crud] = useProjectState(urlState.projectId);
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
    [state, state?.projectName, urlState?.view]
  );

  const [settings, setSettings] = useSettings();
  React.useEffect(
    function updateBodyBackground() {
      if (settings) {
        document.body.className = settings.theme;
      }
    },
    [settings, settings?.theme]
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
  }, [urlState.projectId, loadingDefault]);

  let isMakeSelect = false;
  let main = <Loading />;
  if (!state || !settings) {
    if (urlState.projectId || !settings) {
      return <Loading />;
    }

    if (!MODE_FEATURES.useDefaultProject) {
      isMakeSelect = true;
      main = <MakeSelectProject />;
    }
  } else {
    // No clue why this needs to be casted. T must extend DefaultView
    // and DefaultView contains 'editor'!!!
    const view = urlState.view || ('editor' as T);
    const Route = routes.find((r) => r.endpoint === view)?.view || NotFound;
    main = (
      <ErrorBoundary>
        <Route />
      </ErrorBoundary>
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
            {MODE_FEATURES.appHeader && !isMakeSelect && <Header />}
            <main className={'view view-' + (urlState.view || 'editor')}>
              {urlState.projectId && <Navigation pages={routes} />}
              {main}
            </main>
          </div>
        </SettingsContext.Provider>
      </UrlStateContext.Provider>
    </ProjectContext.Provider>
  );
}
