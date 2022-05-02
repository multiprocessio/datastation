import { IconChartBar, IconTable } from '@tabler/icons';
import * as React from 'react';
import { ArrayShape, ObjectShape } from 'shape';
import {
  GraphPanelInfo,
  PanelInfo,
  PanelResult,
  ProjectPage,
  TablePanelInfo,
} from '../shared/state';
import { Button } from './components/Button';
import { Dropdown } from './components/Dropdown';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  flattenObjectFields,
  orderedObjectFields,
  wellFormedGraphInput,
} from './components/FieldPicker';
import { Panel, VISUAL_PANELS } from './Panel';
import { PANEL_GROUPS, PANEL_UI_DETAILS } from './panels';
import { ProjectContext } from './state';
import { UrlStateContext } from './urlState';

function NewPanel({
  onClick,
}: {
  onClick: (type: keyof typeof PANEL_UI_DETAILS) => void;
}) {
  const groups = PANEL_GROUPS.map((g) => ({
    name: g.label,
    id: g.label,
    items: g.panels.map((p) => ({
      render(close: () => void) {
        return (
          <Button
            onClick={() => {
              onClick(p);
              close();
            }}
          >
            {PANEL_UI_DETAILS[p].label}
          </Button>
        );
      },
      id: p,
    })),
  }));

  return (
    <Dropdown
      className="add-panel"
      trigger={(open) => (
        <Button
          onClick={(e) => {
            e.preventDefault();
            open();
          }}
        >
          Add Panel
        </Button>
      )}
      title="Add Panel"
      groups={groups}
    />
  );
}

export function PanelList({
  page,
  reevalPanel,
  panelResults,
}: {
  page: ProjectPage;
  pageIndex: number;
  panelResults: Array<PanelResult>;
  reevalPanel: (panelId: string) => Promise<Array<PanelInfo>>;
}) {
  const { crud } = React.useContext(ProjectContext);

  async function updatePanel(
    panel: PanelInfo,
    position?: number,
    insert?: boolean
  ) {
    const index =
      position === undefined
        ? page.panels.findIndex((p) => p.id === panel.id)
        : position;
    await crud.updatePanel(panel, index, !!insert);

    if (VISUAL_PANELS.includes(panel.type)) {
      // Give time before re-evaling
      setTimeout(() => reevalPanel(panel.id), 300);
    }
  }

  function newPanel(panelIndex: number) {
    const panel = page.panels[panelIndex];

    const shapeIsOk = wellFormedGraphInput(
      panel && panel.resultMeta ? panel.resultMeta.shape : null
    );

    const orderedFields = shapeIsOk
      ? orderedObjectFields(
          (panel.resultMeta.shape as ArrayShape).children as ObjectShape
        )
      : [];
    let firstNumber: string;
    let firstString: string;
    for (const groups of orderedFields) {
      if (groups.name === 'String') {
        firstString = groups.elements[0] ? groups.elements[0][0] : '';
      }

      if (groups.name === 'Number') {
        firstNumber = groups.elements[0] ? groups.elements[0][0] : '';
      }
    }

    function makePanel(type: string, prefix: string) {
      let next: PanelInfo;
      const o = (panel.resultMeta.shape as ArrayShape).children as ObjectShape;
      if (type === 'graph') {
        next = new GraphPanelInfo(page.id, {
          name: prefix + ' ' + panel.name,
          panelSource: panel.id,
          x: firstString,
          ys: [{ field: firstNumber, label: firstNumber }],
        });
      } else {
        next = new TablePanelInfo(page.id, {
          name: prefix + ' ' + panel.name,
          panelSource: panel.id,
          columns: flattenObjectFields(o).map(([field]) => ({
            field,
            label: field,
          })),
        });
      }

      updatePanel(next, panelIndex + 1, true);
    }

    const offerToTable =
      panel && !VISUAL_PANELS.includes(panel.type) && shapeIsOk;

    const offerToGraph = offerToTable && firstNumber && firstString;

    return (
      <div className="new-panel">
        <NewPanel
          onClick={(type: keyof typeof PANEL_UI_DETAILS) => {
            const panel = PANEL_UI_DETAILS[type].factory(
              page.id,
              `Untitled panel #${page.panels.length + 1}`
            );
            console.log(panel);
            updatePanel(panel, panelIndex + 1, true);
          }}
        />

        {offerToGraph ? (
          <span
            className="new-panel-short"
            title="Generate a graph for the above panel"
          >
            <Button onClick={() => makePanel('graph', 'Graph of')} icon>
              <IconChartBar />
            </Button>
          </span>
        ) : null}
        {offerToTable ? (
          <span
            className="new-panel-short"
            title="Generate a table for the above panel"
          >
            <Button onClick={() => makePanel('table', 'Data from')} icon>
              <IconTable />
            </Button>
          </span>
        ) : null}
      </div>
    );
  }

  const {
    state: { fullScreen },
  } = React.useContext(UrlStateContext);
  const fullScreenIndex = fullScreen
    ? page.panels.findIndex((p) => p.id === fullScreen)
    : null;
  if (typeof fullScreenIndex === 'number' && fullScreenIndex >= 0) {
    const panel = page.panels[fullScreenIndex];
    return (
      <Panel
        panel={panel}
        updatePanel={updatePanel}
        panelResults={panelResults}
        reevalPanel={reevalPanel}
        panelIndex={fullScreenIndex}
        removePanel={crud.deletePanel}
        panels={page.panels}
      />
    );
  }

  return (
    <React.Fragment>
      {newPanel(-1)}
      {page.panels.map((panel, panelIndex) => (
        <ErrorBoundary key={panel.id}>
          <Panel
            panel={panel}
            updatePanel={updatePanel}
            panelResults={panelResults}
            reevalPanel={reevalPanel}
            panelIndex={panelIndex}
            removePanel={crud.deletePanel}
            panels={page.panels}
          />
          {newPanel(panelIndex)}
        </ErrorBoundary>
      ))}
    </React.Fragment>
  );
}
