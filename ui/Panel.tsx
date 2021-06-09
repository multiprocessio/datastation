import * as React from 'react';

import {
  ProjectPage,
  PanelInfo,
  PanelResult,
  GraphPanelInfo,
  HTTPPanelInfo,
  ProgramPanelInfo,
  TablePanelInfo,
  LiteralPanelInfo,
} from './ProjectStore';
import { GraphPanel, GraphPanelDetails } from './GraphPanel';
import { evalHTTPPanel, HTTPPanelDetails } from './HTTPPanel';
import { evalProgramPanel, ProgramPanelDetails } from './ProgramPanel';
import { TablePanel, TablePanelDetails } from './TablePanel';
import { evalLiteralPanel, LiteralPanelDetails } from './LiteralPanel';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';
import { Select } from './component-library/Select';
import { Textarea } from './component-library/Textarea';

export const PANEL_TYPE_ICON = {
  literal: 'format_quote',
  program: 'code',
  table: 'table_chart',
  graph: 'bar_chart',
  http: 'http',
};

export async function evalPanel(
  page: ProjectPage,
  panelId: number,
  panelResults: Array<PanelResult>
) {
  const panel = page.panels[panelId];
  switch (panel.type) {
    case 'program':
      return await evalProgramPanel(panel as ProgramPanelInfo, panelResults);
    case 'literal':
      return evalLiteralPanel(panel as LiteralPanelInfo);
    case 'graph':
      return (panelResults[(panel as GraphPanelInfo).graph.panelSource] || {})
        .value;
    case 'table':
      return (panelResults[(panel as TablePanelInfo).table.panelSource] || {})
        .value;
    case 'http':
      return await evalHTTPPanel(panel as HTTPPanelInfo);
  }
}

export function Panel({
  panel,
  updatePanel,
  panelResults = [],
  reevalPanel,
  panelIndex,
  removePanel,
  movePanel,
  panelCount,
}: {
  panel: PanelInfo;
  updatePanel: (d: PanelInfo) => void;
  panelResults: Array<PanelResult>;
  reevalPanel: (i: number) => void;
  panelIndex: number;
  removePanel: (i: number) => void;
  movePanel: (from: number, to: number) => void;
  panelCount: number;
}) {
  let body = null;
  const exception =
    panelResults[panelIndex] && panelResults[panelIndex].exception;
  if (!exception && panel.type === 'table') {
    body = (
      <TablePanel
        panel={panel as TablePanelInfo}
        panelResults={panelResults}
        panelIndex={panelIndex}
      />
    );
  } else if (!exception && panel.type === 'graph') {
    body = (
      <GraphPanel
        panel={panel as GraphPanelInfo}
        data={panelResults[panelIndex]}
      />
    );
  }

  return (
    <div className={`panel ${panel.collapsed ? 'panel--hidden' : ''}`}>
      <div className="panel-head">
        <div className="panel-header">
          <Button
            icon
            disabled={panelIndex === 0}
            onClick={() => {
              movePanel(panelIndex, panelIndex - 1);
            }}
          >
            keyboard_arrow_up
          </Button>
          <Button
            icon
            disabled={panelIndex === panelCount - 1}
            onClick={() => {
              movePanel(panelIndex, panelIndex + 1);
            }}
          >
            keyboard_arrow_down
          </Button>
          <Button
            icon
            onClick={() => {
              panel.details = !panel.details;
              updatePanel(panel);
            }}
          >
            {PANEL_TYPE_ICON[panel.type]}
          </Button>
          <Input
            className="panel-name"
            onChange={(value: string) => {
              panel.name = value;
              updatePanel(panel);
            }}
            value={panel.name}
          />
          <span className="panel-controls flex-right">
            <span className="last-run">
              {(panelResults[panelIndex] || {}).lastRun
                ? 'Last run ' + panelResults[panelIndex].lastRun
                : 'Not run'}
            </span>
            <Button icon onClick={() => reevalPanel(panelIndex)}>
              play_arrow
            </Button>
            <Button
              icon
              onClick={() => {
                panel.collapsed = !panel.collapsed;
                updatePanel(panel);
              }}
            >
              {panel.collapsed ? 'visibility_off' : 'visibility'}
            </Button>
            <Button icon onClick={() => removePanel(panelIndex)}>
              delete
            </Button>
          </span>
        </div>
        {panel.details && (
          <div className="panel-details">
            <div>
              <span>Type:</span>
              <Select
                value={panel.type}
                onChange={(value: string) => {
                  let newPanel;
                  switch (value) {
                    case 'literal':
                      newPanel = new LiteralPanelInfo(panel.name);
                      break;
                    case 'program':
                      newPanel = new ProgramPanelInfo(panel.name);
                      break;
                    case 'table':
                      newPanel = new TablePanelInfo(panel.name);
                      break;
                    case 'graph':
                      newPanel = new GraphPanelInfo(panel.name);
                      break;
                    case 'http':
                      newPanel = new HTTPPanelInfo(panel.name);
                      break;
                    default:
                      throw new Error(`Invalid panel type: ${value}`);
                  }

                  newPanel.content = panel.content;
                  updatePanel(newPanel);
                }}
              >
                <option value="literal">Literal</option>
                <option value="program">Code</option>
                <option value="table">Table</option>
                <option value="graph">Graph</option>
                <option value="http">HTTP Request</option>
              </Select>
            </div>
            {panel.type === 'table' && (
              <TablePanelDetails
                panel={panel as TablePanelInfo}
                updatePanel={updatePanel}
                panelCount={panelCount}
              />
            )}
            {panel.type === 'literal' && (
              <LiteralPanelDetails
                panel={panel as LiteralPanelInfo}
                updatePanel={updatePanel}
              />
            )}
            {panel.type === 'http' && (
              <HTTPPanelDetails
                panel={panel as HTTPPanelInfo}
                updatePanel={updatePanel}
              />
            )}
            {panel.type === 'graph' && (
              <GraphPanelDetails
                panel={panel as GraphPanelInfo}
                updatePanel={updatePanel}
                panelCount={panelCount}
              />
            )}
            {panel.type === 'program' && (
              <ProgramPanelDetails
                panel={panel as ProgramPanelInfo}
                updatePanel={updatePanel}
                panelIndex={panelIndex}
              />
            )}
          </div>
        )}
      </div>
      {!panel.collapsed && (
        <div className="panel-body">
          {body ? (
            body
          ) : (
            <Textarea
              spellCheck="false"
              value={panel.content}
              onChange={(value: string) => {
                panel.content = value;
                updatePanel(panel);
              }}
              className="editor"
            />
          )}
          {exception && (
            <div className="error">
              <div>Error evaluating panel:</div>
              <pre>
                <code>{exception}</code>
              </pre>
            </div>
          )}
          {panel.type === 'program' && (
            <div className="alert alert-info">
              Use builtin functions, <code>DM_setPanel($some_array_data)</code>
              and <code>DM_getPanel($panel_number)</code>, to interact with
              other panels.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
