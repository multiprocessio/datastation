import * as React from 'react';
import { MODE, MODE_FEATURES, VERSION } from '../shared/constants';
import { LANGUAGES } from '../shared/languages';
import log from '../shared/log';
import '../shared/polyfill';
import { DEFAULT_PROJECT, ProjectState } from '../shared/state';
import { Dashboard } from './Dashboard';
import { Editor } from './Editor';
import { NotFound } from './NotFound';
import { makeStore, ProjectContext, ProjectStore } from './ProjectStore';
import { UrlStateContext, useUrlState } from './urlState';

if (MODE === 'browser') {
  Object.values(LANGUAGES).map((l) => {
    if (l.inMemoryInit) {
      l.inMemoryInit();
    }
  });
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
  const [urlState, setUrlState] = useUrlState();
  const [state, setProjectState] = useProjectState(projectId, store);

  const [headerHeight, setHeaderHeightInternal] = React.useState(0);
  const setHeaderHeight = React.useCallback((e: HTMLElement) => {
    if (!e) {
      return;
    }

    setHeaderHeightInternal(e.offsetHeight);
  }, []);

  const body =
    {
      editor: Editor,
      dashboard: Dashboard,
    }[urlState.view || 'editor'] || NotFound;

  return (
    <ProjectContext.Provider value={{ state, setProjectState }}>
      <UrlStateContext.Provider value={{ urlState, setUrlState }}>
        <div className={`app app--${MODE}`}>
          {MODE_FEATURES.appHeader && (
            <Header setHeaderHeight={setHeaderHeight} />
          )}
          <main
            style={{
              marginTop: headerHeight,
              height: `calc(100% - ${headerHeight}px)`,
            }}
          >
            {body}
          </main>
        </div>
      </UrlStateContext.Provider>
    </ProjectContext.Provider>
  );
}
