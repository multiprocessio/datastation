import * as pako from 'pako';
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

function getQueryParameter(param: String) {
  const query = window.location.search.substring(1);
  const vars = query.split('&');

  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');
    if (pair[0] === param) {
      return pair[1];
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
    shareStateCache.state = rawStateToObjects(uncompressed);
  }

  return shareStateCache.state;
}

function useProjectState(
  projectId: string,
  store: ProjectStore,
  shareState: ProjectState | undefined
): [ProjectState, (d: ProjectState) => void] {
  const [state, setProjectState] = React.useState<ProjectState>(null);

  function setState(newState: ProjectState) {
    store.update(projectId, newState);
    setProjectState(newState);
  }

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
  const shareState = getShareState();
  const [projectId, setProjectId] = React.useState(
    (shareState && shareState.id) || 'default'
  );

  const store = makeStore(MODE);
  const [state, updateProjectState] = useProjectState(
    projectId,
    store,
    shareState
  );

  // TODO: handle when there are zero pages?
  const [currentPage, setCurrentPage] = React.useState(0);

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
            <div className="flex-right vertical-align-center">
              <Button onClick={() => updateProjectState(DEFAULT_PROJECT)}>
                Reset
              </Button>
              {MODE_FEATURES.shareProject && (
                <div className="share" tabIndex={1000}>
                  <Button onClick={() => computeShareURL()}>Share</Button>
                  <div className="share-details">
                    <p>This URL contains the entire project state.</p>
                    <p>
                      Project data is not stored on a server. But if you do use
                      this URL, the data encoded in the URL will appear in
                      DataStation web server access logs.
                    </p>
                    <p>
                      If you make changes, you will need to click "Share" again
                      to get a new URL.
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
              <a
                href="https://datastation.multiprocess.io/#online-environment"
                target="_blank"
              >
                About
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
