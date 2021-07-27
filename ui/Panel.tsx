import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import circularSafeStringify from 'json-stringify-safe';
import * as CSV from 'papaparse';
import * as React from 'react';
import { MODE_FEATURES, RPC } from '../shared/constants';
import { toString } from '../shared/shape';
import {
  ConnectorInfo,
  FilePanelInfo,
  GraphPanelInfo,
  HTTPPanelInfo,
  LiteralPanelInfo,
  PanelInfo,
  PanelResult,
  PanelResultMeta,
  ProgramPanelInfo,
  ProjectPage,
  ServerInfo,
  SQLPanelInfo,
  TablePanelInfo,
} from '../shared/state';
import { asyncRPC } from './asyncRPC';
import { Button } from './component-library/Button';
import { CodeEditor } from './component-library/CodeEditor';
import { Confirm } from './component-library/Confirm';
import { Input } from './component-library/Input';
import { Select } from './component-library/Select';
import { ErrorBoundary } from './ErrorBoundary';
import { evalFilePanel, FilePanelDetails } from './FilePanel';
import { GraphPanel, GraphPanelDetails } from './GraphPanel';
import { evalHTTPPanel, HTTPPanelDetails } from './HTTPPanel';
import { evalLiteralPanel, LiteralPanelDetails } from './LiteralPanel';
import { evalProgramPanel, ProgramPanelDetails } from './ProgramPanel';
import { evalSQLPanel, SQLPanelDetails } from './SQLPanel';
import { evalColumnPanel, TablePanel, TablePanelDetails } from './TablePanel';

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
  indexIdMap: Array<string>,
  panelResults: Array<PanelResult>,
  connectors: Array<ConnectorInfo>,
  servers: Array<ServerInfo>
): Promise<PanelResult> {
  const panel = page.panels[panelId];
  switch (panel.type) {
    case 'program':
      return await evalProgramPanel(
        panel as ProgramPanelInfo,
        panelResults,
        indexIdMap
      );
    case 'literal': {
      return await evalLiteralPanel(panel as LiteralPanelInfo);
    }
    case 'sql': {
      return await evalSQLPanel(
        panel as SQLPanelInfo,
        indexIdMap,
        connectors,
        servers
      );
    }
    case 'graph': {
      const { graph } = panel as GraphPanelInfo;
      return await evalColumnPanel(
        graph.panelSource,
        [graph.x, graph.y.field],
        indexIdMap,
        panelResults
      );
    }
    case 'table': {
      const { table } = panel as TablePanelInfo;
      return await evalColumnPanel(
        table.panelSource,
        table.columns.map((c) => c.field),
        indexIdMap,
        panelResults
      );
    }
    case 'http': {
      return await evalHTTPPanel(panel as HTTPPanelInfo, null, servers);
    }
    case 'file': {
      return await evalFilePanel(panel as FilePanelInfo, null, servers);
    }
  }
}

function valueAsString(value: any) {
  try {
    if (
      Array.isArray(value) &&
      Object.keys(value[0]).every(
        (k) => value === null || typeof value[0][k] !== 'object'
      )
    ) {
      return [CSV.unparse(value), 'text/csv', '.csv'];
    } else {
      return [
        circularSafeStringify(value, null, 2),
        'application/json',
        '.json',
      ];
    }
  } catch (e) {
    return [String(value), 'text/plain', '.txt'];
  }
}

function download(filename: string, value: any, isChart = false) {
  // SOURCE: https://stackoverflow.com/a/18197341/1507139
  const element = document.createElement('a');
  let [dataURL, mimeType, extension] = ['', '', ''];
  if (isChart) {
    if (!value) {
      console.error('Invalid context ref');
      return;
    }
    mimeType = 'image/png';
    dataURL = (value as HTMLCanvasElement).toDataURL(mimeType, 1.0);
    extension = '.png';
  } else {
    let text;
    [text, mimeType, extension] = valueAsString(value);
    dataURL = `data:${mimeType};charset=utf-8,` + encodeURIComponent(text);
  }
  element.setAttribute('href', dataURL);
  element.setAttribute('download', filename + extension);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

function PreviewResults({
  panelOut,
  results,
}: {
  panelOut: keyof PanelResult;
  results: PanelResultMeta;
}) {
  if (!results.lastRun) {
    return <React.Fragment>Panel not yet run.</React.Fragment>;
  }

  if (!results[panelOut]) {
    return <React.Fragment>Nothing to show.</React.Fragment>;
  }

  if (panelOut === 'shape') {
    return <code>{toString(results.shape)}</code>;
  }

  return <code>{results[panelOut]}</code>;
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
  panelResults: Array<PanelResultMeta>;
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

  const [panelOut, setPanelOut] = React.useState<
    'preview' | 'stdout' | 'shape'
  >('preview');
  const results = panelResults[panelIndex] || new PanelResultMeta();
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
      if (e.preventDefault) {
        e.preventDefault();
      }
    }
  }

  const runningProgram =
    results.loading && panel.type === 'program' && MODE_FEATURES.killProcess;
  function killProcess() {
    return asyncRPC<ProgramPanelInfo, void, void>(
      RPC.KILL_PROCESS,
      null,
      panel as ProgramPanelInfo
    );
  }

  return (
    <div
      className={`panel ${hidden ? 'panel--hidden' : ''} ${
        panel.type === 'file' && !results.exception ? 'panel--empty' : ''
      } ${results.loading ? 'panel--loading' : ''}`}
      tabIndex={1001}
      ref={panelRef}
      onKeyDown={keyboardShortcuts}
    >
      <ErrorBoundary>
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
              autoWidth
              onChange={(value: string) => {
                panel.name = value;
                updatePanel(panel);
              }}
              value={panel.name}
            />
            <span className="material-icons">
              {PANEL_TYPE_ICON[panel.type]}
            </span>
            {!alwaysOpenTypes.includes(panel.type) && (
              <span title={details ? 'Hide Details' : 'Show Details'}>
                <Button icon onClick={() => setDetails(!details)}>
                  {details ? 'unfold_less' : 'unfold_more'}
                </Button>
              </span>
            )}
            <span className="panel-controls vertical-align-center flex-right">
              <span className="last-run">
                {results.loading ? (
                  'Running...'
                ) : results.lastRun ? (
                  <>
                    <span
                      className={
                        results.exception ? 'text-failure' : 'text-success'
                      }
                    >
                      {results.exception ? 'Failed' : 'Succeeded'}
                    </span>{' '}
                    {formatDistanceToNow(results.lastRun, { addSuffix: true })}
                  </>
                ) : (
                  'Run to apply changes'
                )}
              </span>
              <span
                title={
                  runningProgram
                    ? 'Kill Process'
                    : 'Evaluate Panel (Ctrl-Enter)'
                }
              >
                <Button
                  icon
                  onClick={() =>
                    runningProgram ? killProcess() : reevalPanel(panelIndex)
                  }
                  type="primary"
                >
                  {runningProgram ? 'close' : 'play_arrow'}
                </Button>
              </span>
              <span
                title={
                  !results.value ? 'Nothing to Download' : 'Download Results'
                }
              >
                <Button
                  icon
                  disabled={!results.value}
                  onClick={() =>
                    download(
                      panel.name,
                      panel.type === 'graph'
                        ? panelRef.current.querySelector('canvas')
                        : results.value,
                      panel.type === 'graph'
                    )
                  }
                >
                  file_download
                </Button>
              </span>
              <span title="Hide Panel">
                <Button icon onClick={() => setHidden(!hidden)}>
                  {hidden ? 'visibility' : 'visibility_off'}
                </Button>
              </span>
              <span title="Delete Panel">
                <Confirm
                  onConfirm={() => removePanel(panelIndex)}
                  message="delete this panel"
                  action="Delete"
                  render={(confirm: () => void) => (
                    <Button icon onClick={confirm}>
                      delete
                    </Button>
                  )}
                />
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
                  <option value="program">Code</option>
                  <option value="http">HTTP Request</option>
                  <option value="sql">SQL</option>
                  <option value="graph">Graph</option>
                  <option value="file">File</option>
                  <option value="literal">Literal</option>
                  <option value="table">Table</option>
                </Select>
              </div>
              {panel.type === 'table' && (
                <TablePanelDetails
                  panel={panel as TablePanelInfo}
                  updatePanel={updatePanel}
                  panels={panels}
                  data={
                    panelResults[(panel as TablePanelInfo).table.panelSource]
                  }
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
                  data={
                    panelResults[(panel as GraphPanelInfo).graph.panelSource]
                  }
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
                    id={panel.id}
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
                  <div className="alert alert-error">
                    <div>Error evaluating panel:</div>
                    <pre>
                      <code>{exception}</code>
                    </pre>
                  </div>
                )}
                {panel.type === 'program' && (
                  <div className="alert alert-info">
                    <p>
                      Use builtin functions,{' '}
                      <code>DM_setPanel($some_array_data)</code> and{' '}
                      <code>DM_getPanel($panel_number)</code>, to interact with
                      other panels. For example:{' '}
                      <code>
                        const passthrough = DM_getPanel(0);
                        DM_setPanel(passthrough);
                      </code>
                      .
                    </p>
                    {(panel as ProgramPanelInfo).program.type === 'julia' && (
                      <p>
                        Install{' '}
                        <a href="https://github.com/JuliaIO/JSON.jl">JSON.jl</a>{' '}
                        to script with Julia.
                      </p>
                    )}
                    {(panel as ProgramPanelInfo).program.type === 'r' && (
                      <p>
                        Install <a href="https://rdrr.io/cran/rjson/">rjson</a>{' '}
                        to script with R.
                      </p>
                    )}
                  </div>
                )}
                {panel.type === 'sql' && (
                  <div className="alert alert-info">
                    Use <code>DM_getPanel($panel_number)</code> to reference
                    other panels. Once you have called this once for one panel,
                    use <code>t$panel_number</code> to refer to it again. For
                    example:{' '}
                    <code>
                      SELECT age, name FROM DM_getPanel(0) WHERE t0.age &gt; 1;
                    </code>
                    .
                  </div>
                )}
                {panel.type === 'http' && MODE_FEATURES.corsOnly && (
                  <div className="alert alert-info">
                    Since this runs in the browser, the server you are talking
                    to must set CORS headers otherwise the request will not
                    work.
                  </div>
                )}
                {panel.type === 'http' && (
                  <div className="alert alert-info">
                    Use the textarea to supply a HTTP request body. This will be
                    ignored for <code>GET</code> and <code>HEAD</code> requests.
                  </div>
                )}
              </div>
              {previewableTypes.includes(panel.type) && (
                <div className="panel-out">
                  <div className="panel-out-header">
                    <Button
                      className={panelOut === 'preview' ? 'selected' : ''}
                      onClick={() => setPanelOut('preview')}
                    >
                      Preview
                    </Button>
                    <Button
                      className={panelOut === 'shape' ? 'selected' : ''}
                      onClick={() => setPanelOut('shape')}
                    >
                      Inferred Schema
                    </Button>
                    {panel.type === 'program' && (
                      <Button
                        className={panelOut === 'stdout' ? 'selected' : ''}
                        onClick={() => setPanelOut('stdout')}
                      >
                        Stdout
                      </Button>
                    )}
                  </div>
                  <div className="panel-preview">
                    <pre className="panel-preview-results">
                      <PreviewResults results={results} panelOut={panelOut} />
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}
