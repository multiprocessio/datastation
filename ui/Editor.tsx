import * as React from 'react';
import { MODE_FEATURES } from '../shared/constants';
import '../shared/polyfill';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Version } from './components/Version';
import { ConnectorList } from './ConnectorList';
import { PageList } from './PageList';
import { ServerList } from './ServerList';
import { Sidebar } from './Sidebar';
import { ProjectContext } from './state';
import { Updates } from './Updates';
import { UrlStateContext } from './urlState';

export function Editor() {
  const { state: urlState, setState: setUrlState } =
    React.useContext(UrlStateContext);
  const { state, crud } = React.useContext(ProjectContext);
  // This allows us to render the sidebar in tests where we
  // prepopulate connectors and servers
  const hasSidebar = Boolean(
    MODE_FEATURES.connectors ||
      state.connectors?.length ||
      state.servers?.length
  );

  return (
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
