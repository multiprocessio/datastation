import { IconTrash } from '@tabler/icons';
import * as React from 'react';
import { MODE_FEATURES } from '../shared/constants';
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

export function makeReevalPanel(
  page: ProjectPage,
  state: ProjectState,
  updatePanelInternal: (p: PanelInfo) => void
) {
  return async function reevalPanel(
    panelId: string
  ): Promise<Array<PanelInfo>> {
    const { connectors, servers } = state;

    const panel = page.panels.find((p) => p.id === panelId);
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

    const affectedPanels = [panel];
    // Re-run all dependent visual panels
    if (!VISUAL_PANELS.includes(panel.type)) {
      for (const dep of page.panels) {
        if (
          (dep.type === 'graph' &&
            (dep as GraphPanelInfo).graph.panelSource === panel.id) ||
          (dep.type === 'table' &&
            (dep as TablePanelInfo).table.panelSource === panel.id)
        ) {
          affectedPanels.push(...(await reevalPanel(dep.id)));
        }
      }
    }

    return affectedPanels;
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
  updatePage: (page: ProjectPage, position: number) => void;
  updatePanel: (
    panel: PanelInfo,
    position: number,
    panelPositions: string[],
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
              updatePage(new ProjectPage('Untitled Page'), -1);
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
  const reevalPanel = makeReevalPanel(page, state, (panel: PanelInfo) => {
    const index = page.panels.findIndex((p) => p.id === panel.id);
    if (index === -1) {
      return;
    }

    updatePanel(panel, index, undefined, { internalOnly: true });
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
                  updatePage(page, i);
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
            updatePage(new ProjectPage('Untitled Page'), -1);
            setPageIndex(state.pages.length - 1);
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
