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
        const rawState = await store.get(projectId);
        console.log('here?????');
        state = rawStateToObjects(rawState);
      } catch (e) {
        console.error(e);
        state = rawStateToObjects(DEFAULT_PROJECT);
        await store.update(projectId, state);
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
  if (!state) {
    // Loading
    return <span>Loading</span>;
  }

  const [currentPage, setCurrentPage] = React.useState(0);

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
    if (!state.connectors) {
      state.connectors = [];
    }
    state.connectors.push(dc);
    updateProjectState({ ...state });
  }

  return (
    <ProjectContext.Provider value={state}>
      <div>
        {MODE_FEATURES.appHeader && (
          <header>
            <span className="logo">{APP_NAME}</span>
            <Input
              onChange={(value: string) => {
                updateProjectState({ ...state, projectName: value });
              }}
              value={state.projectName}
            />
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
