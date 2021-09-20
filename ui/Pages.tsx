import * as React from 'react';
import { EVAL_ERRORS } from '../shared/errors';
import { wait } from '../shared/promise';
import { PanelResultMeta, ProjectPage, ProjectState } from '../shared/state';
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

  const panelResults = page.panels.map((p) => p.resultMeta);

  async function reevalPanel(panelId: string, reset?: boolean) {
    const { connectors, servers } = state;

    const panelIndex = page.panels.findIndex((p) => p.id === panelId);
    if (panelIndex === -1) {
      return;
    }
    const panel = page.panels[panelIndex];
    let resultMeta = panel.resultMeta || new PanelResultMeta();
    resultMeta.lastRun = null;
    resultMeta.loading = !reset;

    panel.resultMeta = resultMeta;
    updatePage(page);
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
      panel.resultMeta = {
        lastRun: new Date(),
        value,
        preview,
        stdout,
        shape,
        contentType,
        size,
        loading: false,
      };
      updatePage(page);
    } catch (e) {
      if (EVAL_ERRORS.map((cls) => new (cls as any)().name).includes(e.name)) {
        e = new PanelPlayWarning(e.message);
      }

      panel.resultMeta = {
        loading: false,
        lastRun: new Date(),
        exception: e,
        stdout: e.stdout,
        preview: '',
        contentType: 'unknown',
        size: 0,
        shape: { kind: 'unknown' },
      };
      updatePage(page);
    }
  }

  async function evalAll() {
    for (let panel of page.panels) {
      await reevalPanel(panel.id);
      await wait(1500);
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
                onChange={(value: string) => {
                  page.name = value;
                  updatePage(page);
                }}
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
