import { IconChartBar, IconTable } from '@tabler/icons';
import * as React from 'react';
import { ArrayShape, ObjectShape } from 'shape';
import {
  GraphPanelInfo,
  PanelInfo,
  PanelResult,
  ProgramPanelInfo,
  ProjectPage,
  TablePanelInfo,
} from '../shared/state';
import { Button } from './components/Button';
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

  async function updatePanel(panel: PanelInfo, position?: number) {
    const index =
      position === undefined
        ? page.panels.findIndex((p) => p.id === panel.id)
        : position;
    // TODO: need to modify the in-memory backend to support this panelPositions index
    await crud.updatePanel(panel, index, page.panels.map(p => p.id));

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

      updatePanel(next, panelIndex);
    }

    const offerToTable =
      panel && !VISUAL_PANELS.includes(panel.type) && shapeIsOk;

    const offerToGraph = offerToTable && firstNumber && firstString;

    return (
      <div className="new-panel">
        <Button
          onClick={() => {
            const panel = new ProgramPanelInfo(page.id, {
              name: `Untitled panel #${page.panels.length + 1}`,
              type: 'python',
            });
            updatePanel(panel, panelIndex + 1);
          }}
          options={PANEL_GROUPS.map((group) => (
            <optgroup label={group.label} key={group.label}>
              {group.panels.map((name) => {
                const panelDetails = PANEL_UI_DETAILS[name];
                return (
                  <option value={panelDetails.id} key={panelDetails.id}>
                    {panelDetails.label}
                  </option>
                );
              })}
            </optgroup>
          ))}
        >
          Add Panel
        </Button>
        {offerToGraph ? (
          <span title="Generate a graph for the above panel">
            <Button onClick={() => makePanel('graph', 'Graph of')} icon>
              <IconChartBar />
            </Button>
          </span>
        ) : null}
        {offerToTable ? (
          <span title="Generate a table for the above panel">
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
