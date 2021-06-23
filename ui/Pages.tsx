import * as React from 'react';

import { ProjectState, ProjectPage } from '../shared/state';

import { PanelResult } from './ProjectStore';
import { Page } from './Page';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';

type IDDict<T> = { [k: string]: T };

export function Pages({
  state,
  addPage,
  updatePage,
  setCurrentPage,
  currentPage,
}: {
  state: ProjectState;
  addPage: (page: ProjectPage) => void;
  updatePage: (page: ProjectPage) => void;
  setCurrentPage: (i: number) => void;
  currentPage: number;
}) {
  const page = state.pages[currentPage];
  const [panelResultsByPage, setPanelResultsByPage] = React.useState<
    IDDict<Array<PanelResult>>
  >({});

  // Reset all page results when project changes
  React.useEffect(() => {
    setPanelResultsByPage({});
  }, [state.id]);

  // Make sure panelResults are initialized when page changes.
  React.useEffect(() => {
    if (!panelResultsByPage[page.id]) {
      setPanelResultsByPage({ ...panelResultsByPage, [page.id]: [] });
    }
  }, [page.id]);

  if (!panelResultsByPage || !panelResultsByPage[page.id]) {
    return null;
  }

  function setPanelResults(panelIndex: number, result: PanelResult) {
    panelResultsByPage[page.id][panelIndex] = result;
    setPanelResultsByPage({ ...panelResultsByPage });
  }

  return (
    <div className="section pages">
      <div className="section-title">
        <Input
          className="page-name page-name--current"
          onChange={(value: string) => updatePage({ ...page, name: value })}
          value={page.name}
        />
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
