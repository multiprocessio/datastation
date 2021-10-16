import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import * as React from 'react';
import { MODE, MODE_FEATURES } from '../shared/constants';
import log from '../shared/log';
import '../shared/polyfill';
import {
  GetProjectsRequest,
  GetProjectsResponse,
  MakeProjectRequest,
  MakeProjectResponse,
  OpenProjectRequest,
  OpenProjectResponse,
} from '../shared/rpc';
import { ConnectorInfo, ProjectPage, ServerInfo } from '../shared/state';
import { asyncRPC } from './asyncRPC';
import { Alert } from './components/Alert';
import { Button } from './components/Button';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Input } from './components/Input';
import { ConnectorList } from './ConnectorList';
import { PageList } from './PageList';
import { ServerList } from './ServerList';
import { Sidebar } from './Sidebar';
import { Updates } from './Updates';
import { UrlStateContext } from './urlState';

export function Editor() {
  const {
    state: { projectId },
  } = React.useContext(UrlStateContext);

  const [makeProjectError, setMakeProjectError] = React.useState('');
  async function makeProject(projectId: string) {
    try {
      await asyncRPC<MakeProjectRequest, MakeProjectResponse>('makeProject', {
        projectId,
      });
      setUrlState({ projectId });
    } catch (e) {
      setMakeProjectError(e.message);
    }
  }

  const currentPageKey = 'currentPage:' + projectId;
  const [currentPage, _setCurrentPage] = React.useState(
    +localStorage.getItem(currentPageKey) || 0
  );
  function setCurrentPage(p: number) {
    localStorage.setItem(currentPageKey, String(p) || '0');
    return _setCurrentPage(p);
  }

  React.useEffect(() => {
    if (state && state.projectName) {
      log.info(state);
      document.title = state.projectName;
    }

    // Set body overflow once on init
    if (MODE_FEATURES.noBodyYOverflow) {
      document.body.style.overflowY = 'hidden';
    }
  }, [state && state.projectName]);

  const [projectNameTmp, setProjectNameTmp] = React.useState('');

  const [projects, setProjects] = React.useState<GetProjectsResponse | null>(
    null
  );
  React.useEffect(() => {
    async function load() {
      const projects = await asyncRPC<GetProjectsRequest, GetProjectsResponse>(
        'getProjects',
        null
      );
      setProjects(projects);
    }

    if (MODE === 'server' && !projects) {
      load();
    }
  }, []);

  if ((!state && projectId) || (MODE === 'server' && !projects)) {
    return (
      <div className="loading">
        Loading...
        <span id="spin"></span>
      </div>
    );
  }

  function updatePage(page: ProjectPage) {
    state.pages[currentPage] = page;
    updateProjectState(state);
  }

  function addPage(page: ProjectPage) {
    state.pages.push(page);
    updateProjectState(state);
  }

  function deletePage(at: number) {
    state.pages.splice(at, 1);
    updateProjectState(state);
  }

  function updateConnector(id: string, dc: ConnectorInfo) {
    const index = (state.connectors || []).findIndex((c) => c.id === id);
    if (index === -1) {
      state.connectors.push(dc);
      return;
    }
    state.connectors[index] = dc;
    updateProjectState(state);
  }

  function addConnector(dc: ConnectorInfo) {
    state.connectors.push(dc);
    updateProjectState(state);
  }

  function deleteConnector(id: string) {
    const at = (state.connectors || []).findIndex((c) => c.id === id);
    if (at === -1) {
      return;
    }
    state.connectors.splice(at, 1);
    updateProjectState(state);
  }

  function updateServer(id: string, dc: ServerInfo) {
    const index = (state.servers || []).findIndex((c) => c.id === id);
    if (index === -1) {
      state.servers.push(dc);
      return;
    }
    state.servers[index] = dc;
    updateProjectState(state);
  }

  function addServer(dc: ServerInfo) {
    state.servers.push(dc);
    updateProjectState(state);
  }

  function deleteServer(id: string) {
    const at = (state.servers || []).findIndex((c) => c.id === id);
    if (at === -1) {
      return;
    }
    state.servers.splice(at, 1);
    updateProjectState(state);
  }

  async function openProject() {
    await asyncRPC<OpenProjectRequest, OpenProjectResponse>(
      'openProject',
      null
    );
    window.close();
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
                onClick={() => makeProject(projectNameTmp)}
              >
                {projectNameTmp ? 'Go!' : 'Pick a name'}
              </Button>
            </div>
            {makeProjectError && (
              <Alert type="error" children={makeProjectError} />
            )}
            {MODE === 'desktop' && (
              <div className="project-existing">
                <p>Or open an existing project.</p>
                <div className="form-row">
                  <Button onClick={openProject}>Open</Button>
                </div>
              </div>
            )}
            {MODE === 'server' && projects.length ? (
              <div className="project-existing">
                <p>Or open an existing project.</p>
                {projects.map(({ name, createdAt }) => (
                  <div className="form-row">
                    <h3>{name}</h3>
                    <div>
                      Created{' '}
                      {formatDistanceToNow(new Date(createdAt), {
                        addSuffix: true,
                      })}
                    </div>
                    <a href={'/?projectId=' + name}>Open</a>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <PageList
            state={state}
            updatePage={updatePage}
            addPage={addPage}
            deletePage={deletePage}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
          />
        )}
        <Version />
      </div>
    </React.Fragment>
  );
}
