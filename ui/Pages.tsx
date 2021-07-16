import * as React from 'react';

import { MODE_FEATURES } from '../shared/constants';
import {
  ProjectState,
  ProjectPage,
  PanelResult,
  PanelResults,
} from '../shared/state';

import { evalPanel } from './Panel';
import { Panels } from './Panels';
import { asyncRPC } from './asyncRPC';
import { Button } from './component-library/Button';
import { Confirm } from './component-library/Confirm';
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

  function setPanelResultsByPage(results: PanelResults, valueChange: boolean) {
    setPanelResultsByPageInternal(results);
    if (valueChange && MODE_FEATURES.storeResults && results[page.id]) {
      asyncRPC<any, void, void>(
        'storeResults',
        null,
        results[page.id].map((r) => r.value)
      );
    }
  }

  // Make sure panelResults are initialized when page changes.
  React.useEffect(() => {
    if (page && !panelResultsByPage[page.id]) {
      setPanelResultsByPage({ ...panelResultsByPage, [page.id]: [] }, true);
    }
  }, [page && page.id]);

  function setPanelResults(
    panelIndex: number,
    result: PanelResult,
    valueChange: boolean = false
  ) {
    panelResultsByPage[page.id][panelIndex] = result;
    setPanelResultsByPage({ ...panelResultsByPage }, valueChange);
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

  const panelResults = panelResultsByPage[page.id];

  async function reevalPanel(panelIndex: number, reset?: boolean) {
    const { connectors, servers } = state;

    let panel = panelResults[panelIndex] || new PanelResult();
    panel.lastRun = null;
    panel.loading = !reset;

    setPanelResults(panelIndex, panel);
    if (reset) {
      return;
    }

    try {
      const [r, stdout] = await evalPanel(
        page,
        panelIndex,
        panelResults,
        connectors,
        servers
      );
      setPanelResults(
        panelIndex,
        {
          lastRun: new Date(),
          value: r,
          stdout,
          loading: false,
        },
        true
      );
    } catch (e) {
      setPanelResults(
        panelIndex,
        {
          loading: false,
          lastRun: new Date(),
          exception: e.stack || e.message,
          stdout: e.stdout,
        },
        true
      );
    }
  }

  async function evalAll() {
    for (let i = 0; i < page.panels.length; i++) {
      await reevalPanel(i);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  return (
    <div className="section pages">
      <div className="section-title">
        <div className="vertical-align-center">
          <span title="Delete Page">
            <Confirm
              right
              onConfirm={() => {
                deletePage(currentPage);
                setCurrentPage(Math.min(state.pages.length - 1, 0));
              }}
              message="delete this page"
              action="Delete"
              className="page-delete"
              render={(confirm: () => void) => (
                <Button icon onClick={confirm}>
                  delete
                </Button>
              )}
            />
          </span>
          <Input
            className="page-name page-name--current"
            onChange={(value: string) => updatePage({ ...page, name: value })}
            value={page.name}
          />
          <span title="Evaluate all panels sequentially">
            <Button icon onClick={evalAll} type="primary">
              play_arrow
            </Button>
          </span>
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

      <Panels
        page={page}
        updatePage={updatePage}
        reevalPanel={reevalPanel}
        panelResults={panelResults}
      />
    </div>
  );
}
