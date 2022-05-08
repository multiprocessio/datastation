import { IconTrash } from '@tabler/icons';
import * as React from 'react';
import { MODE, MODE_FEATURES } from '../shared/constants';
import {
  GraphPanelInfo,
  PanelInfo,
  PanelResult,
  ProjectPage,
  ProjectState,
  TablePanelInfo,
} from '../shared/state';
import { Button } from './components/Button';
import { Confirm } from './components/Confirm';
import { Input } from './components/Input';
import { loadDefaultProject } from './Header';
import { VISUAL_PANELS } from './Panel';
import { PanelList } from './PanelList';
import { PANEL_UI_DETAILS } from './panels';
import { LocalStorageStore } from './ProjectStore';

export function makeReevalPanel(
  state: ProjectState,
  updatePanelInternal: (p: PanelInfo) => void
) {
  return async function reevalPanel(
    panelId: string
  ): Promise<Array<PanelInfo>> {
    // Somehow stuff goes out of date in browser mode. So fetch before eval
    if (MODE === 'browser') {
      const store = new LocalStorageStore();
      state = await store.get(state.projectName);
    }
    const { connectors, servers } = state;

    let panel: PanelInfo;
    let page: ProjectPage;
    outer: for (const pagep of state.pages) {
      for (const p of pagep.panels) {
        if (p.id === panelId) {
          page = pagep;
          panel = p;
          break outer;
        }
      }
    }
    if (!panel) {
      return;
    }

    const idMap: Record<string | number, string> = {};
    page.panels.forEach((p, index) => {
      idMap[index] = p.id;
      idMap[p.name] = p.id;
    });
    const panelUIDetails = PANEL_UI_DETAILS[panel.type];
    panel.resultMeta = PanelResult.fromJSON(
      await panelUIDetails.eval(panel, page.panels, idMap, connectors, servers)
    );
    // Important! Just needs to trigger a state reload.
    updatePanelInternal(panel);

    if (panel.resultMeta.exception) {
      return;
    }

    // Re-run all dependent visual panels
    if (!VISUAL_PANELS.includes(panel.type)) {
      for (const dep of page.panels) {
        if (
          (dep.type === 'graph' &&
            (dep as GraphPanelInfo).graph.panelSource === panel.id) ||
          (dep.type === 'table' &&
            (dep as TablePanelInfo).table.panelSource === panel.id)
        ) {
          await reevalPanel(dep.id);
        }
      }
    }
  };
}

export function PageList({
  state,
  deletePage,
  updatePage,
  updatePanel,
  setPageIndex,
  pageIndex,
}: {
  state: ProjectState;
  deletePage: (id: string) => void;
  updatePage: (page: ProjectPage, position: number, insert: boolean) => void;
  updatePanel: (
    panel: PanelInfo,
    position: number,
    insert: boolean,
    opts?: { internalOnly: boolean }
  ) => void;
  setPageIndex: (i: number) => void;
  pageIndex: number;
}) {
  const page: ProjectPage | null = state.pages[pageIndex] || null;

  if (!page) {
    return (
      <div className="section pages pages--empty">
        <p>This is an empty project.</p>
        <p>
          <Button
            type="primary"
            onClick={() => {
              updatePage(new ProjectPage(`Untitled Page #1`), -1, true);
            }}
          >
            Add a page
          </Button>{' '}
          to get started!
        </p>
        {MODE_FEATURES.useDefaultProject && (
          <p>
            Or,{' '}
            <Button onClick={loadDefaultProject}>
              load the example project
            </Button>{' '}
            to get a feel for what DataStation can do.
          </p>
        )}
      </div>
    );
  }

  const panelResults = page.panels.map((p) => p.resultMeta);
  const reevalPanel = makeReevalPanel(state, (panel: PanelInfo) => {
    const index = page.panels.findIndex((p) => p.id === panel.id);
    if (index === -1) {
      return;
    }

    // Only an internal update if not in browser mode. Otherwise the browser does need to save the resultmeta
    updatePanel(panel, index, false, { internalOnly: MODE !== 'browser' });
  });

  return (
    <div className="section pages">
      <div className="section-title">
        {state.pages.map((page: ProjectPage, i: number) =>
          i === pageIndex ? (
            <div
              className="vertical-align-center page-name page-name--current"
              key={page.id}
            >
              <Input
                onChange={(value: string) => {
                  page.name = value;
                  updatePage(page, i, false);
                }}
                value={page.name}
              />

              <span title="Delete Page">
                <Confirm
                  right
                  onConfirm={() => {
                    deletePage(page.id);
                    setPageIndex(Math.min(state.pages.length - 1, 0));
                  }}
                  message="delete this page"
                  action="Delete"
                  className="page-delete"
                  render={(confirm: () => void) => (
                    <Button icon onClick={confirm}>
                      <IconTrash />
                    </Button>
                  )}
                />
              </span>

              {/*
              <span title="Evaluate all panels sequentially">
                <Button icon onClick={evalAll} type="primary">
                  play_arrow
                </Button>
              </span>
	       */}
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
          className="add-page"
          onClick={() => {
            const newPageIndex = state.pages.length;
            updatePage(
              new ProjectPage(`Untitled Page #${newPageIndex + 1}`),
              newPageIndex,
              true
            );
            setPageIndex(newPageIndex);
          }}
        >
          +
        </Button>
      </div>

      <PanelList
        page={page}
        pageIndex={pageIndex}
        reevalPanel={reevalPanel}
        panelResults={panelResults}
      />
    </div>
  );
}
