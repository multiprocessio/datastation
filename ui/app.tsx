import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { APP_NAME, IS_DESKTOP_APP, MODE } from './constants';
import { Pages } from './Pages';
import { DataConnectors } from './DataConnectors';
import {
  DEFAULT_PROJECT,
  makeStore,
  ProjectPage,
  ProjectStore,
  ProjectState,
  DataConnectorInfo,
} from './ProjectStore';
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
        state = await store.get(projectId);
      } catch (e) {
        console.error(e);
        state = DEFAULT_PROJECT;
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

  function updatePage(page: ProjectPage) {
    state.pages[state.currentPage] = page;
    updateProjectState({ ...state });
  }

  function addPage(page: ProjectPage) {
    state.pages.push(page);
    updateProjectState({ ...state });
  }

  function setCurrentPage(pageIndex: number) {
    updateProjectState({ ...state, currentPage: pageIndex });
  }

  function updateDataConnector(dcIndex: number, dc: DataConnectorInfo) {
    state.dataConnectors[dcIndex] = dc;
    updateProjectState({ ...state });
  }

  function addDataConnector(dc: DataConnectorInfo) {
    if (!state.dataConnectors) {
      state.dataConnectors = [];
    }
    state.dataConnectors.push(dc);
    updateProjectState({ ...state });
  }

  return (
    <div>
      {!IS_DESKTOP_APP && (
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
        <DataConnectors
          state={state}
          updateDataConnector={updateDataConnector}
          addDataConnector={addDataConnector}
        />
        <Pages
          state={state}
          updatePage={updatePage}
          addPage={addPage}
          setCurrentPage={setCurrentPage}
        />
      </main>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
