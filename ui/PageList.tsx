import * as React from 'react';
import { MODE_FEATURES } from '../shared/constants';
import { EVAL_ERRORS } from '../shared/errors';
import {
  DEFAULT_PROJECT,
  PanelResultMeta,
  ProjectPage,
  ProjectState,
} from '../shared/state';
import { Button } from './components/Button';
import { Confirm } from './components/Confirm';
import { Input } from './components/Input';
import { Link } from './components/Link';
import { Dashboard } from './dashboard';
import { PanelPlayWarning } from './errors';
import { NotFound } from './NotFound';
import { PanelList } from './PanelList';
import { PANEL_UI_DETAILS } from './panels';
import { ProjectContext } from './ProjectStore';
import { Scheduler } from './scheduler';
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
      const idMap: Record<string | number, string> = {};
      page.panels.forEach((p, index) => {
        idMap[index] = p.id;
        idMap[p.name] = p.id;
      });
      const panelUIDetails = PANEL_UI_DETAILS[panel.type];
      const { value, size, contentType, preview, stdout, shape, arrayCount } =
        await panelUIDetails.eval(
          panel,
          page.panels,
          idMap,
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
  const { state: urlState, setState: setUrlState } =
    React.useContext(UrlStateContext);
  const { setState: setProjectState } = React.useContext(ProjectContext);

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
        {MODE_FEATURES.useDefaultProject && (
          <p>
            Or,{' '}
            <Button
              onClick={() => {
                setProjectState(DEFAULT_PROJECT);
                setUrlState({
                  projectId: DEFAULT_PROJECT.projectName,
                  page: 0,
                  view: 'editor',
                });
              }}
            >
              load the example project
            </Button>{' '}
            to get a feel for what DataStation can do.
          </p>
        )}
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

  const MainChild =
    {
      editor: PanelList,
      dashboard: Dashboard,
      scheduler: Scheduler,
    }[urlState.view] || NotFound;

  return (
    <div className="section pages">
      <div className="section-title">
        {state.pages.map((page: ProjectPage, i: number) =>
          i === pageIndex ? (
            <div
              className="vertical-align-center page-name page-name--current"
              key={page.id}
            >
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

      <div className="vertical-align-center">
        <Link
          className={`page-mode ${
            urlState.view === 'editor' ? 'page-mode--on' : ''
          }`}
          args={{ view: 'editor' }}
        >
          Editor
        </Link>
        <Link
          className={`page-mode ${
            urlState.view === 'scheduler' ? 'page-mode--on' : ''
          }`}
          args={{ view: 'scheduler' }}
        >
          Schedule Exports
        </Link>
        <Link
          className={`page-mode ${
            urlState.view === 'dashboard' ? 'page-mode--on' : ''
          }`}
          args={{ view: 'dashboard' }}
        >
          Dashboard
        </Link>
      </div>

      <MainChild
        page={page}
        updatePage={updatePage}
        reevalPanel={reevalPanel}
        panelResults={panelResults}
      />
    </div>
  );
}
