import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { APP_NAME, MODE, MODE_FEATURES } from '../shared/constants';
import {
  ProjectPage,
  ProjectState,
  ConnectorInfo,
  DEFAULT_PROJECT,
  rawStateToObjects,
} from '../shared/state';

import { Pages } from './Pages';
import { Connectors } from './Connectors';
import { makeStore, ProjectContext, ProjectStore } from './ProjectStore';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';

function useProjectState(
  projectId: string,
  store: ProjectStore
): [ProjectState, (d: ProjectState) => void] {
  const [state, setProjectState] = React.useState<ProjectState>(null);

  function setState(newState: ProjectState) {
    store.update(projectId, newState);
    setProjectState(newState);
  }

  // Re-read state when projectId changes
  React.useEffect(() => {
    async function fetch() {
      let state;
      try {
        let rawState = await store.get(projectId);
        if (!rawState) {
          state = DEFAULT_PROJECT;
        } else {
          state = rawStateToObjects(rawState);
        }
      } catch (e) {
        console.error(e);
        state = DEFAULT_PROJECT;
      }
      setProjectState(state);
    }

    fetch();
  }, [projectId]);

  return [state, setState];
}

function App() {
  // TODO: projectId needs to come from opened project.
  const [projectId, setProjectId] = React.useState('default');

  const store = makeStore(MODE);
  const [state, updateProjectState] = useProjectState(projectId, store);

  // TODO: handle when there are zero pages?
  const [currentPage, setCurrentPage] = React.useState(0);

  if (!state) {
    // Loading
    return <span>Loading</span>;
  }

  function updatePage(page: ProjectPage) {
    state.pages[currentPage] = page;
    updateProjectState({ ...state });
  }

  function addPage(page: ProjectPage) {
    state.pages.push(page);
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

  return (
    <ProjectContext.Provider value={state}>
      <div>
        {MODE_FEATURES.appHeader && (
          <header className="vertical-align-center">
            <span className="logo">{APP_NAME}</span>
            <div className="flex-right">
              <Button onClick={() => updateProjectState(DEFAULT_PROJECT)}>
                Reset app state
              </Button>
              <a href="https://datastation.multiprocess.io/demo.html" target="_blank">
                About this app
              </a>
              <a href="https://github.com/multiprocessio/datastation" target="_blank">
                <img height="32" width="32" src="https://cdn.jsdelivr.net/npm/simple-icons@v5/icons/github.svg" />
              </a>
            </div>
          </header>
        )}
        <main>
          {MODE_FEATURES.connectors && (
            <Connectors
              state={state}
              updateConnector={updateConnector}
              addConnector={addConnector}
            />
          )}
          <Pages
            state={state}
            updatePage={updatePage}
            addPage={addPage}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
          />
        </main>
      </div>
    </ProjectContext.Provider>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
