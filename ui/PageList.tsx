import * as React from 'react';
import { EVAL_ERRORS } from '../shared/errors';
import { PanelResultMeta, ProjectPage, ProjectState } from '../shared/state';
import { Button } from './components/Button';
import { Confirm } from './components/Confirm';
import { Input } from './components/Input';
import { PanelPlayWarning } from './errors';
import { PanelList } from './PanelList';
import { PANEL_UI_DETAILS } from './panels';
import { UrlStateContext } from './urlState';

export function makeReevalPanel(
  page: ProjectPage,
  state: ProjectState,
  updatePage: (page: ProjectPage) => void
) {
  return async function reevalPanel(panelId: string, reset?: boolean) {
    const { connectors, servers } = state;
    const start = new Date();

    const panel = page.panels.find((p) => p.id === panelId);
    if (!panel) {
      return;
    }
    let resultMeta = panel.resultMeta || new PanelResultMeta();
    resultMeta.loading = !reset;

    panel.resultMeta = resultMeta;
    updatePage(page);
    if (reset) {
      resultMeta.lastRun = null;
      return;
    }

    try {
      const indexIdMap: Array<string> = page.panels.map((p) => p.id);
      const panelUIDetails = PANEL_UI_DETAILS[panel.type];
      const { value, size, contentType, preview, stdout, shape, arrayCount } =
        await panelUIDetails.eval(
          panel,
          page.panels,
          indexIdMap,
          connectors,
          servers
        );
      panel.resultMeta = {
        lastRun: new Date(),
        elapsed: new Date().valueOf() - start.valueOf(),
        value,
        preview,
        stdout,
        shape,
        arrayCount,
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
        elapsed: new Date().valueOf() - start.valueOf(),
        lastRun: new Date(),
        exception: e,
        stdout: e.stdout,
        preview: '',
        contentType: 'unknown',
        size: 0,
        arrayCount: null,
        shape: { kind: 'unknown' },
      };
      updatePage(page);
    }
  };
}

export function PageList({
  state,
  addPage,
  deletePage,
  updatePage,
  setPageIndex,
  pageIndex,
}: {
  state: ProjectState;
  addPage: (page: ProjectPage) => void;
  deletePage: (i: number) => void;
  updatePage: (page: ProjectPage) => void;
  setPageIndex: (i: number) => void;
  pageIndex: number;
}) {
  const page: ProjectPage | null = state.pages[pageIndex] || null;
  const { setState: setUrlState } = React.useContext(UrlStateContext);

  if (!page) {
    return (
      <div className="section pages pages--empty">
        <p>This is an empty project.</p>
        <p>
          <Button
            type="primary"
            onClick={() => {
              addPage(new ProjectPage('Untitled Page'));
              setPageIndex(state.pages.length - 1);
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
  const reevalPanel = makeReevalPanel(page, state, updatePage);

  async function evalAll() {
    for (let panel of page.panels) {
      await reevalPanel(panel.id);
    }
  }

  return (
    <div className="section pages">
      <div className="section-title">
        {state.pages.map((page: ProjectPage, i: number) =>
          i === pageIndex ? (
            <div className="vertical-align-center current-page" key={page.id}>
              <span title="Delete Page">
                <Confirm
                  right
                  onConfirm={() => {
                    deletePage(pageIndex);
                    setPageIndex(Math.min(state.pages.length - 1, 0));
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

              <span title="Enter dashboard mode">
                <Button icon onClick={() => setUrlState({ view: 'dashboard' })}>
                  bar_chart
                </Button>
              </span>

              <span title="Enter scheduled export mode">
                <Button icon onClick={() => setUrlState({ view: 'scheduler' })}>
                  schedule
                </Button>
              </span>
            </div>
          ) : (
            <Button
              key={page.id}
              className="page-name"
              onClick={() => setPageIndex(i)}
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
            setPageIndex(state.pages.length - 1);
          }}
        >
          New Page
        </Button>
      </div>

      <PanelList
        page={page}
        updatePage={updatePage}
        reevalPanel={reevalPanel}
        panelResults={panelResults}
      />
    </div>
  );
}
