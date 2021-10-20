import * as React from 'react';
import { MODE_FEATURES } from '../shared/constants';
import '../shared/polyfill';
import { ConnectorInfo, ProjectPage, ServerInfo } from '../shared/state';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loading } from './components/Loading';
import { Version } from './components/Version';
import { ConnectorList } from './ConnectorList';
import { PageList } from './PageList';
import { ProjectContext } from './ProjectStore';
import { ServerList } from './ServerList';
import { Sidebar } from './Sidebar';
import { Updates } from './Updates';
import { UrlStateContext } from './urlState';

export function Editor() {
  const {
    state: { projectId, page: pageIndex },
    setState: setUrlState,
  } = React.useContext(UrlStateContext);
  const { state, setState: setProjectState } = React.useContext(ProjectContext);

  React.useEffect(() => {
    if (state && state.projectName) {
      console.log(state);
      document.title = state.projectName;
    }

    // Set body overflow once on init
    if (MODE_FEATURES.noBodyYOverflow) {
      document.body.style.overflowY = 'hidden';
    }
  }, [state && state.projectName]);

  function updatePage(page: ProjectPage) {
    state.pages[pageIndex] = page;
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

  if (!state) {
    return <Loading />;
  }

  // This allows us to render the sidebar in tests where we
  // prepopulate connectors and servers
  const hasSidebar = Boolean(
    MODE_FEATURES.connectors ||
      state.connectors?.length ||
      state.servers?.length
  );

  return (
    <React.Fragment>
      {projectId && hasSidebar && (
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
          pageIndex={pageIndex}
          setPageIndex={(i) => setUrlState({ page: i })}
        />
        <Version />
      </div>
    </React.Fragment>
  );
}
