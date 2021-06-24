import * as React from 'react';
import circularSafeStringify from 'json-stringify-safe';

import {
  ConnectorInfo,
  ProjectPage,
  PanelInfo,
  GraphPanelInfo,
  HTTPPanelInfo,
  SQLPanelInfo,
  ProgramPanelInfo,
  TablePanelInfo,
  LiteralPanelInfo,
  FilePanelInfo,
} from '../shared/state';
import { MODE_FEATURES } from '../shared/constants';

import { PanelResult } from './ProjectStore';
import { GraphPanel, GraphPanelDetails } from './GraphPanel';
import { evalHTTPPanel, HTTPPanelDetails } from './HTTPPanel';
import { evalFilePanel, FilePanelDetails } from './FilePanel';
import { evalProgramPanel, ProgramPanelDetails } from './ProgramPanel';
import { TablePanel, TablePanelDetails } from './TablePanel';
import { evalLiteralPanel, LiteralPanelDetails } from './LiteralPanel';
import { evalSQLPanel, SQLPanelDetails } from './SQLPanel';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';
import { Select } from './component-library/Select';
import { CodeEditor } from './component-library/CodeEditor';

export const PANEL_TYPE_ICON = {
  literal: 'format_quote',
  program: 'code',
  table: 'table_chart',
  graph: 'bar_chart',
  http: 'http',
  sql: 'table_rows',
  file: 'description',
};

export async function evalPanel(
  page: ProjectPage,
  panelId: number,
  panelResults: Array<PanelResult>,
  connectors: Array<ConnectorInfo>
): Promise<[any, string]> {
  const panel = page.panels[panelId];
  switch (panel.type) {
    case 'program':
      return await evalProgramPanel(panel as ProgramPanelInfo, panelResults);
    case 'literal':
      return [await evalLiteralPanel(panel as LiteralPanelInfo), ''];
    case 'sql':
      return [
        evalSQLPanel(panel as SQLPanelInfo, panelResults, connectors),
        '',
      ];
    case 'graph':
      return [
        (panelResults[(panel as GraphPanelInfo).graph.panelSource] || {}).value,
        '',
      ];
    case 'table':
      return [
        (panelResults[(panel as TablePanelInfo).table.panelSource] || {}).value,
        '',
      ];
    case 'http':
      return [await evalHTTPPanel(panel as HTTPPanelInfo), ''];
    case 'file':
      return [await evalFilePanel(panel as FilePanelInfo), ''];
  }
}

function previewValueAsString(value: any) {
  try {
    return circularSafeStringify(value, null, 2);
  } catch (e) {
    return String(value);
  }
}

export function Panel({
  panel,
  updatePanel,
  panelResults,
  reevalPanel,
  panelIndex,
  removePanel,
  movePanel,
  panels,
}: {
  panel: PanelInfo;
  updatePanel: (d: PanelInfo) => void;
  panelResults: Array<PanelResult>;
  reevalPanel: (i: number) => void;
  panelIndex: number;
  removePanel: (i: number) => void;
  movePanel: (from: number, to: number) => void;
  panels: Array<PanelInfo>;
}) {
  const previewableTypes = ['http', 'sql', 'program', 'file', 'literal'];
  const alwaysOpenTypes = ['table', 'graph', 'http', 'file'];
  const [details, setDetails] = React.useState(true);
  const [hidden, setHidden] = React.useState(false);

  let body = null;
  const exception =
    panelResults[panelIndex] && panelResults[panelIndex].exception;
  if (panel.type === 'table') {
    body = (
      <TablePanel panel={panel as TablePanelInfo} panelResults={panelResults} />
    );
  } else if (panel.type === 'graph') {
    body = (
      <GraphPanel
        panel={panel as GraphPanelInfo}
        data={panelResults[panelIndex]}
      />
    );
  } else if (panel.type === 'file') {
    body = <span />;
  }

  const [panelOut, setPanelOut] = React.useState('preview');
  const [preview, setPreview] = React.useState('');
  const results: PanelResult = panelResults[panelIndex] || {
    value: null,
    exception: null,
    lastRun: null,
    stdout: '',
  };
  React.useEffect(() => {
    if (!results.value) {
      setPreview('');
      return;
    }

    if (previewableTypes.includes(panel.type)) {
      if (results && !results.exception) {
        const resultsLines = previewValueAsString(results.value).split('\n');
        setPreview(resultsLines.slice(0, 50).join('\n'));
      }
    }
  }, [results.value, results.exception]);

  const language =
    panel.type === 'program' ? (panel as ProgramPanelInfo).program.type : 'sql';

  const panelRef = React.useRef(null);
  function keyboardShortcuts(e: React.KeyboardEvent) {
    if (
      !panelRef.current &&
      panelRef.current !== document.activeElement &&
      !panelRef.current.contains(document.activeElement)
    ) {
      return;
    }

    if (e.ctrlKey && e.code === 'Enter') {
      reevalPanel(panelIndex);
      e.preventDefault();
    }
  }

  return (
    <div
      className={`panel ${hidden ? 'panel--hidden' : ''} ${
        panel.type === 'file' ? 'panel--empty' : ''
      }`}
      tabIndex={1001}
      ref={panelRef}
      onKeyDown={keyboardShortcuts}
    >
      <div className="panel-head">
        <div className="panel-header vertical-align-center">
          <span title="Move Up">
            <Button
              icon
              disabled={panelIndex === 0}
              onClick={() => {
                movePanel(panelIndex, panelIndex - 1);
              }}
            >
              keyboard_arrow_up
            </Button>
          </span>
          <span title="Move Down">
            <Button
              icon
              disabled={panelIndex === panels.length - 1}
              onClick={() => {
                movePanel(panelIndex, panelIndex + 1);
              }}
            >
              keyboard_arrow_down
            </Button>
          </span>
          <Input
            className="panel-name"
            onChange={(value: string) => {
              panel.name = value;
              updatePanel(panel);
            }}
            value={panel.name}
          />
          <span className="material-icons">{PANEL_TYPE_ICON[panel.type]}</span>
          {!alwaysOpenTypes.includes(panel.type) && (
            <span title={details ? 'Hide Details' : 'Show Details'}>
              <Button icon onClick={() => setDetails(!details)}>
                {details ? 'unfold_less' : 'unfold_more'}
              </Button>
            </span>
          )}
          <span className="panel-controls vertical-align-center flex-right">
            <span className="last-run">
              {results.lastRun
                ? 'Last run ' + results.lastRun
                : 'Run to apply changes'}
            </span>
            <span title="Evaluate Panel (Ctrl-Enter)">
              <Button
                icon
                onClick={() => reevalPanel(panelIndex)}
                type="primary"
              >
                play_arrow
              </Button>
            </span>
            <span title="Hide Panel">
              <Button icon onClick={() => setHidden(!hidden)}>
                {hidden ? 'visibility' : 'visibility_off'}
              </Button>
            </span>
            <span title="Delete Panel">
              <Button icon onClick={() => removePanel(panelIndex)}>
                delete
              </Button>
            </span>
          </span>
        </div>
        {details && (
          <div className="panel-details">
            <div className="form-row">
              <Select
                label="Type"
                value={panel.type}
                onChange={(value: string) => {
                  let newPanel;
                  switch (value) {
                    case 'sql':
                      newPanel = new SQLPanelInfo(panel.name);
                      break;
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
                    case 'file':
                      newPanel = new FilePanelInfo(panel.name);
                      break;
                    default:
                      throw new Error(`Invalid panel type: ${value}`);
                  }

                  newPanel.content = panel.content;
                  updatePanel(newPanel);
                }}
              >
                <option value="sql">SQL</option>
                <option value="program">Code</option>
                <option value="http">HTTP Request</option>
                <option value="table">Table</option>
                <option value="graph">Graph</option>
                <option value="file">File</option>
                <option value="literal">Literal</option>
              </Select>
            </div>
            {panel.type === 'table' && (
              <TablePanelDetails
                panel={panel as TablePanelInfo}
                updatePanel={updatePanel}
                panels={panels}
                data={panelResults[(panel as TablePanelInfo).table.panelSource]}
              />
            )}
            {panel.type === 'sql' && (
              <SQLPanelDetails
                panel={panel as SQLPanelInfo}
                updatePanel={updatePanel}
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
                panels={panels}
                data={panelResults[(panel as GraphPanelInfo).graph.panelSource]}
              />
            )}
            {panel.type === 'program' && (
              <ProgramPanelDetails
                panel={panel as ProgramPanelInfo}
                updatePanel={updatePanel}
                panelIndex={panelIndex}
              />
            )}
            {panel.type === 'file' && (
              <FilePanelDetails
                panel={panel as FilePanelInfo}
                updatePanel={updatePanel}
              />
            )}
          </div>
        )}
      </div>
      {!hidden && (
        <div className="panel-body-container">
          <div className="flex">
            <div className="panel-body">
              {body ? (
                body
              ) : (
                <CodeEditor
                  onKeyDown={keyboardShortcuts}
                  value={panel.content}
                  onChange={(value: string) => {
                    panel.content = value;
                    updatePanel(panel);
                  }}
                  language={language}
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
                  Use builtin functions,{' '}
                  <code>DM_setPanel($some_array_data)</code> and{' '}
                  <code>DM_getPanel($panel_number)</code>, to interact with
                  other panels. For example:{' '}
                  <code>
                    const passthrough = DM_getPanel(0);
                    DM_setPanel(passthrough);
                  </code>
                  .
                </div>
              )}
              {panel.type === 'sql' && (
                <div className="alert alert-info">
                  Use <code>DM_getPanel($panel_number)</code> to reference other
                  panels. Once you have called this once for one panel, use{' '}
                  <code>t$panel_number</code> to refer to it again. For example:{' '}
                  <code>
                    SELECT age, name FROM DM_getPanel(0) WHERE t0.age &gt; 1;
                  </code>
                  .
                </div>
              )}
              {panel.type === 'http' && MODE_FEATURES.corsOnly && (
                <div className="alert alert-info">
                  Since this runs in the browser, the server you are talking to
                  must set CORS headers otherwise the request will not work.
                </div>
              )}
              {panel.type === 'http' && (
                <div className="alert alert-info">
                  Use the textarea to supply a HTTP request body. This will be
                  ignored for <code>GET</code> and
                  <code>HEAD</code> requests.
                </div>
              )}
            </div>
            {previewableTypes.includes(panel.type) && (
              <div className="panel-out">
                <div className="panel-out-header">
                  <Button
                    disabled={panel.type !== 'program'}
                    className={panelOut === 'preview' ? 'selected' : ''}
                    onClick={() => setPanelOut('preview')}
                  >
                    Preview
                  </Button>
                  {panel.type === 'program' && (
                    <Button
                      className={panelOut === 'output' ? 'selected' : ''}
                      onClick={() => setPanelOut('output')}
                    >
                      Output
                    </Button>
                  )}
                </div>
                <div className="panel-preview">
                  <pre className="panel-preview-results">
                    {!(panelOut === 'preview' ? preview : results.stdout) ? (
                      results.lastRun ? (
                        'Nothing to show.'
                      ) : (
                        'Panel not yet run.'
                      )
                    ) : (
                      <code>
                        {panelOut === 'preview' ? preview : results.stdout}
                      </code>
                    )}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
