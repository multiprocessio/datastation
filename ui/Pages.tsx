import * as React from 'react';

import { MODE_FEATURES } from '../shared/constants';
import {
  ProjectState,
  ProjectPage,
  PanelResult,
  PanelResults,
} from '../shared/state';

import { asyncRPC } from './asyncRPC';
import { Page } from './Page';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';

export function Pages({
  state,
  addPage,
  deletePage,
  updatePage,
  setCurrentPage,
  currentPage,
}: {
  state: ProjectState;
  addPage: (page: ProjectPage) => void;
  deletePage: (i: number) => void;
  updatePage: (page: ProjectPage) => void;
  setCurrentPage: (i: number) => void;
  currentPage: number;
}) {
  const page: ProjectPage | null = state.pages[currentPage] || null;
  const [panelResultsByPage, setPanelResultsByPageInternal] =
    React.useState<PanelResults>({});

  function setPanelResultsByPage(results: PanelResults) {
    if (MODE_FEATURES.storeResults && results[page.id]) {
      asyncRPC<any, void, void>(
        'storeResults',
        null,
        results[page.id].map((r) => r.value)
      ).catch((e) => {
        console.error(e);
      });
    }

    setPanelResultsByPageInternal(results);
  }

  // Reset all page results when project changes
  React.useEffect(() => {
    setPanelResultsByPage({});
  }, [state.id]);

  // Make sure panelResults are initialized when page changes.
  React.useEffect(() => {
    if (page && !panelResultsByPage[page.id]) {
      setPanelResultsByPage({ ...panelResultsByPage, [page.id]: [] });
    }
  }, [page && page.id]);

  function setPanelResults(panelIndex: number, result: PanelResult) {
    panelResultsByPage[page.id][panelIndex] = result;
    setPanelResultsByPage({ ...panelResultsByPage });
  }

  if (!page) {
    return (
      <div className="section pages pages--empty">
        <p>This is an empty project.</p>
        <p>
          <Button
            type="primary"
            onClick={() => {
              addPage(new ProjectPage('Untitled Page'));
              setCurrentPage(state.pages.length - 1);
            }}
          >
            Add a page
          </Button>{' '}
          to get started!
        </p>
      </div>
    );
  }

  // Guard against effect that initializes this per page
  if (!panelResultsByPage || !panelResultsByPage[page.id]) {
    return null;
  }

  return (
    <div className="section pages">
      <div className="section-title">
        <div className="vertical-align-center">
          <span title="Delete Page">
            <Button
              icon
              className="page-delete"
              onClick={() => {
                deletePage(currentPage);
                setCurrentPage(Math.min(state.pages.length - 1, 0));
              }}
            >
              delete
            </Button>
          </span>
          <Input
            className="page-name page-name--current"
            onChange={(value: string) => updatePage({ ...page, name: value })}
            value={page.name}
          />
        </div>
        {state.pages.map((page: ProjectPage, i: number) =>
          i === currentPage ? undefined : (
            <Button className="page-name" onClick={() => setCurrentPage(i)}>
              {page.name}
            </Button>
          )
        )}
        <Button
          type="primary"
          className="flex-right"
          onClick={() => {
            addPage(new ProjectPage('Untitled Page'));
            setCurrentPage(state.pages.length - 1);
          }}
        >
          New Page
        </Button>
      </div>

      <Page
        key={page.id}
        page={page}
        connectors={state.connectors}
        updatePage={updatePage}
        panelResults={panelResultsByPage[page.id]}
        setPanelResults={setPanelResults}
      />
    </div>
  );
}
