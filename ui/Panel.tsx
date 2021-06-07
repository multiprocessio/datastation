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
  panelValues: Array<PanelResult>
) {
  const panel = page.panels[panelId];
  switch (panel.type) {
    case 'program':
      return await evalProgramPanel(panel as ProgramPanelInfo, panelValues);
    case 'literal':
      return evalLiteralPanel(panel as LiteralPanelInfo);
    case 'graph':
      return (panelValues[(panel as GraphPanelInfo).graph.panelSource] || {})
        .value;
    case 'table':
      return (panelValues[(panel as TablePanelInfo).table.panelSource] || {})
        .value;
    case 'http':
      return await evalHTTPPanel(panel as HTTPPanelInfo);
  }
}

export function Panel({
  panel,
  updatePanel,
  rows = [],
  reevalPanel,
  panelIndex,
  removePanel,
  movePanel,
  panelCount,
}: {
  panel: PanelInfo;
  updatePanel: (d: PanelInfo) => void;
  rows: Array<PanelResult>;
  reevalPanel: (i: number) => void;
  panelIndex: number;
  removePanel: (i: number) => void;
  movePanel: (from: number, to: number) => void;
  panelCount: number;
}) {
  let body = null;
  const exception = rows[panelIndex] && rows[panelIndex].exception;
  if (!exception && panel.type === 'table') {
    body = (
      <TablePanel
        panel={panel as TablePanelInfo}
        rows={rows}
        panelIndex={panelIndex}
      />
    );
  } else if (!exception && panel.type === 'graph') {
    body = (
      <GraphPanel panel={panel as GraphPanelInfo} data={rows[panelIndex]} />
    );
  }

  return (
    <div className={`panel ${panel.collapsed ? 'panel--hidden' : ''}`}>
      <div className="panel-head">
        <div className="panel-header">
          #
          <input
            className="panel-order"
            type="number"
            min={0}
            max={panelCount - 1}
            value={panelIndex}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              movePanel(panelIndex, +e.target.value)
            }
          />
          <button
            className="button panel-type material-icons"
            type="button"
            onClick={() => {
              panel.details = !panel.details;
              updatePanel(panel);
            }}
          >
            {PANEL_TYPE_ICON[panel.type]}
          </button>
          <input
            className="panel-name"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              panel.name = e.target.value;
              updatePanel(panel);
            }}
            value={panel.name}
          />
          <span className="panel-controls flex-right">
            <span className="last-run">
              {(rows[panelIndex] || {}).lastRun
                ? 'Last run ' + rows[panelIndex].lastRun
                : 'Not run'}
            </span>
            <button
              className="button material-icons"
              type="button"
              onClick={() => reevalPanel(panelIndex)}
            >
              play_arrow
            </button>
            <button
              className="button material-icons"
              type="button"
              onClick={() => {
                panel.collapsed = !panel.collapsed;
                updatePanel(panel);
              }}
            >
              {panel.collapsed ? 'visibility_off' : 'visibility'}
            </button>
            <button
              className="button material-icons"
              type="button"
              onClick={() => removePanel(panelIndex)}
            >
              delete
            </button>
          </span>
        </div>
        {panel.details && (
          <div className="panel-details">
            <div>
              <span>Type:</span>
              <select
                value={panel.type}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  let newPanel;
                  switch (e.target.value) {
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
                      throw new Error(`Invalid panel type: ${e.target.value}`);
                  }

                  newPanel.content = panel.content;
                  updatePanel(newPanel);
                }}
              >
                <option value="literal">Literal</option>
                <option value="program">Code</option>
                <option value="table">Table</option>
                <option value="graph">Graph</option>
                <option value="http">HTTP Request</option>W
              </select>
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
            <textarea
              spellCheck="false"
              value={panel.content}
              onChange={async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                panel.content = e.target.value;
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
