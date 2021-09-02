import * as React from 'react';
import { EVAL_ERRORS } from '../shared/errors';
import {
  PanelResultMeta,
  PanelResults,
  ProjectPage,
  ProjectState,
} from '../shared/state';
import { Button } from './component-library/Button';
import { Confirm } from './component-library/Confirm';
import { Input } from './component-library/Input';
import { PanelPlayWarning } from './errors';
import { evalPanel } from './Panel';
import { Panels } from './Panels';

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
  const [panelResultsByPage, setPanelResultsByPage] =
    React.useState<PanelResults>({});

  // Make sure panelResults are initialized when page changes.
  React.useEffect(() => {
    if (page && !panelResultsByPage[page.id]) {
      setPanelResultsByPage({ ...panelResultsByPage, [page.id]: [] });
    }
  }, [page && page.id]);

  function setPanelResults(panelIndex: number, result: PanelResultMeta) {
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

  const panelResults = panelResultsByPage[page.id];

  async function reevalPanel(panelIndex: number, reset?: boolean) {
    const { connectors, servers } = state;

    let panel = panelResults[panelIndex] || new PanelResultMeta();
    panel.lastRun = null;
    panel.loading = !reset;

    setPanelResults(panelIndex, panel);
    if (reset) {
      return;
    }

    try {
      const indexIdMap: Array<string> = page.panels.map((p) => p.id);
      const { value, size, contentType, preview, stdout, shape } =
        await evalPanel(
          page,
          panelIndex,
          indexIdMap,
          panelResults,
          connectors,
          servers
        );
      setPanelResults(panelIndex, {
        lastRun: new Date(),
        value,
        preview,
        stdout,
        shape,
        contentType,
        size,
        loading: false,
      });
    } catch (e) {
      if (EVAL_ERRORS.map((cls) => cls.name).includes(e.constructor.name)) {
        e = new PanelPlayWarning(e.message);
      }

      setPanelResults(panelIndex, {
        loading: false,
        lastRun: new Date(),
        exception: e,
        stdout: e.stdout,
        preview: '',
        contentType: 'unknown',
        size: 0,
        shape: { kind: 'unknown' },
      });
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
        {state.pages.map((page: ProjectPage, i: number) =>
          i === currentPage ? (
            <div className="vertical-align-center current-page" key={page.id}>
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
                    <Button icon onClick={confirm} type="outline">
                      delete
                    </Button>
                  )}
                />
              </span>

              <Input
                className="page-name"
                onChange={(value: string) =>
                  updatePage({ ...page, name: value })
                }
                autoWidth
                value={page.name}
              />

              <span title="Evaluate all panels sequentially">
                <Button icon onClick={evalAll} type="primary">
                  play_circle
                </Button>
              </span>
            </div>
          ) : (
            <Button
              key={page.id}
              className="page-name"
              onClick={() => setCurrentPage(i)}
            >
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
