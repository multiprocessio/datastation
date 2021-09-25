import formatDistanceStrict from 'date-fns/formatDistanceStrict';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import circularSafeStringify from 'json-stringify-safe';
import * as CSV from 'papaparse';
import * as React from 'react';
import { toString } from 'shape';
import { MODE, MODE_FEATURES, RPC } from '../shared/constants';
import {
  PanelInfo,
  PanelInfoType,
  PanelResult,
  PanelResultMeta,
  ProgramPanelInfo,
} from '../shared/state';
import { humanSize } from '../shared/text';
import { asyncRPC } from './asyncRPC';
import { Alert } from './component-library/Alert';
import { Button } from './component-library/Button';
import { Confirm } from './component-library/Confirm';
import { ErrorBoundary } from './component-library/ErrorBoundary';
import { Highlight } from './component-library/Highlight';
import { Input } from './component-library/Input';
import { Select } from './component-library/Select';
import { PanelPlayWarning } from './errors';
import { PANEL_GROUPS, PANEL_UI_DETAILS } from './panel-components';

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

async function fetchAndDownloadResults(
  panel: PanelInfo,
  panelRef: React.RefObject<HTMLCanvasElement>,
  results: PanelResult
) {
  let value = results.value;
  if (MODE !== 'browser') {
    const res = await asyncRPC<{ id: string }, void, { value: any }>(
      RPC.FETCH_RESULTS,
      null,
      { id: panel.id }
    );
    value = res.value;
  }

  download(
    panel.name,
    panel.type === 'graph' ? panelRef.current.querySelector('canvas') : value,
    panel.type === 'graph'
  );
}

function PreviewResults({
  panelOut,
  results,
}: {
  panelOut: 'preview' | 'stdout' | 'shape' | 'metadata';
  results: PanelResultMeta & { metadata?: string };
}) {
  if (!results.lastRun) {
    return <React.Fragment>Panel not yet run.</React.Fragment>;
  }

  if (panelOut === 'metadata') {
    results = {
      ...results,
      metadata: JSON.stringify(
        {
          Size: humanSize(results.size),
          'Inferred Content-Type': results.contentType,
        },
        null,
        2
      ),
    };
  }

  if (!results[panelOut]) {
    return <React.Fragment>Nothing to show.</React.Fragment>;
  }

  if (panelOut === 'shape') {
    return (
      <Highlight language="javascript">{toString(results.shape)}</Highlight>
    );
  }

  return <Highlight language="json">{results[panelOut]}</Highlight>;
}

function PanelPlayWarningWithLinks({
  msg,
  indexNameMap,
}: {
  msg: string;
  indexNameMap: Array<string>;
}) {
  const children = msg
    .split(/(panel #[0-9]+)|(DM_setPanel\([$a-zA-Z]*\))/)
    .map((c, i) => {
      if (!c) {
        return;
      }
      const prefix = 'panel #';
      if (c.startsWith(prefix)) {
        const index = c.slice(prefix.length);
        return (
          <a key={i} href={'#panel-' + index}>
            [{index}] {indexNameMap[+index]}
          </a>
        );
      }

      if (c.startsWith('DM_setPanel(')) {
        return <code key={i}>{c}</code>;
      }

      return c;
    });

  return <Alert type="warning" children={children} />;
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
  reevalPanel: (id: string) => void;
  panelIndex: number;
  removePanel: (i: number) => void;
  movePanel: (from: number, to: number) => void;
  panels: Array<PanelInfo>;
}) {
  const panelUIDetails = PANEL_UI_DETAILS[panel.type];
  const [details, setDetails] = React.useState(true);
  const [hidden, setHidden] = React.useState(false);

  const [panelOut, setPanelOut] = React.useState<
    'preview' | 'stdout' | 'shape' | 'metadata'
  >('preview');
  const results = panel.resultMeta || new PanelResultMeta();

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
      reevalPanel(panel.id);
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
      id={`panel-${panelIndex}`}
      className={`panel ${hidden ? 'panel--hidden' : ''} ${
        (panel.type === 'file' || panel.type === 'filagg') && !results.exception
          ? 'panel--empty'
          : ''
      } ${results.loading ? 'panel--loading' : ''}`}
      tabIndex={1001}
      ref={panelRef}
      onKeyDown={keyboardShortcuts}
    >
      <ErrorBoundary>
        <div className="panel-head">
          <div
            className={`panel-header ${
              details ? 'panel-header--open' : ''
            } vertical-align-center`}
          >
            <span className="text-muted">#{panelIndex}</span>
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
            <Select
              label="Type"
              value={panel.type}
              onChange={(value: string) => {
                const panelType = value as PanelInfoType;
                const newPanel = PANEL_UI_DETAILS[panelType].factory();
                panel[panelType] = newPanel[panelType];
                updatePanel(newPanel);
              }}
            >
              {PANEL_GROUPS.map((group) => (
                <optgroup label={group.label} key={group.label}>
                  {group.panels.map((name) => {
                    const panelDetails = PANEL_UI_DETAILS[name];
                    return (
                      <option value={panelDetails.id}>
                        {panelDetails.label}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </Select>

            <span className="material-icons">{panelUIDetails.icon}</span>

            <Input
              className="panel-name"
              autoWidth
              onChange={(value: string) => {
                panel.name = value;
                updatePanel(panel);
              }}
              value={panel.name}
            />

            {!panelUIDetails.alwaysOpen && (
              <span title={details ? 'Hide Details' : 'Show Details'}>
                <Button icon onClick={() => setDetails(!details)}>
                  {details ? 'unfold_less' : 'unfold_more'}
                </Button>
              </span>
            )}

            <span className="panel-controls vertical-align-center flex-right">
              <span className="text-muted">
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
                    {formatDistanceToNow(results.lastRun, {
                      addSuffix: true,
                    })}
                    <div>
                      <small>
                        {formatDistanceStrict(
                          results.lastRun.valueOf() - (results.elapsed || 0),
                          results.lastRun.valueOf()
                        )}
                      </small>
                    </div>
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
                    runningProgram ? killProcess() : reevalPanel(panel.id)
                  }
                  type="primary"
                >
                  {runningProgram ? 'close' : 'play_circle'}
                </Button>
              </span>
              <span
                title={
                  !results.lastRun ? 'Panel not yet run' : 'Download Results'
                }
              >
                <Button
                  icon
                  disabled={!results.lastRun}
                  onClick={() =>
                    fetchAndDownloadResults(panel, panelRef, results)
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
                    <Button icon onClick={confirm} type="outline">
                      delete
                    </Button>
                  )}
                />
              </span>
            </span>
          </div>
          {details && (
            <div className="panel-details">
              <panelUIDetails.details
                panelIndex={panelIndex}
                panel={panel}
                updatePanel={updatePanel}
                panels={panels}
              />
            </div>
          )}
        </div>
        {!hidden && (
          <div className="panel-body-container">
            <ErrorBoundary className="panel-body">
              <div className="flex">
                <div className="panel-body">
                  {panelUIDetails.body && (
                    <panelUIDetails.body
                      panel={panel}
                      keyboardShortcuts={keyboardShortcuts}
                      panels={panels}
                    />
                  )}
                  {exception instanceof PanelPlayWarning ? (
                    <PanelPlayWarningWithLinks
                      msg={exception.message}
                      indexNameMap={panels.map(({ name }) => name)}
                    />
                  ) : (
                    exception && (
                      <Alert type="error">
                        <div>Error evaluating panel:</div>
                        <pre>
                          <code>
                            {exception.stack ||
                              exception.message ||
                              String(exception)}
                          </code>
                        </pre>
                      </Alert>
                    )
                  )}
                  {panel.type === 'program' &&
                    ((panel as ProgramPanelInfo).program.type === 'sql' ? (
                      <Alert type="info">
                        Use <code>DM_getPanel($panel_number)</code> to reference
                        other panels. Once you have called this once for one
                        panel, use <code>t$panel_number</code> to refer to it
                        again. For example:{' '}
                        <code>
                          SELECT age, name FROM DM_getPanel(0) WHERE t0.age &gt;
                          1;
                        </code>
                        .
                      </Alert>
                    ) : (
                      <Alert type="info">
                        Use builtin functions,{' '}
                        <code>DM_setPanel($some_array_data)</code> and{' '}
                        <code>DM_getPanel($panel_number)</code>, to interact
                        with other panels. For example:{' '}
                        <code>
                          const passthrough = DM_getPanel(0);
                          DM_setPanel(passthrough);
                        </code>
                        .
                        {(panel as ProgramPanelInfo).program.type ===
                          'julia' && (
                          <React.Fragment>
                            Install{' '}
                            <a href="https://github.com/JuliaIO/JSON.jl">
                              JSON.jl
                            </a>{' '}
                            to script with Julia.
                          </React.Fragment>
                        )}
                        {(panel as ProgramPanelInfo).program.type === 'r' && (
                          <React.Fragment>
                            Install{' '}
                            <a href="https://rdrr.io/cran/rjson/">rjson</a> to
                            script with R.
                          </React.Fragment>
                        )}
                      </Alert>
                    ))}
                  {panel.type === 'http' && MODE_FEATURES.corsOnly && (
                    <Alert type="info">
                      Since this runs in the browser, the server you are talking
                      to must set CORS headers otherwise the request will not
                      work.
                    </Alert>
                  )}
                  {panel.type === 'http' && (
                    <Alert type="info">
                      Use the textarea to supply a HTTP request body. This will
                      be ignored for <code>GET</code> and <code>HEAD</code>{' '}
                      requests.
                    </Alert>
                  )}
                </div>
                {panelUIDetails.previewable && (
                  <div className="panel-out resize resize--left resize--horizontal">
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
                      <Button
                        className={panelOut === 'metadata' ? 'selected' : ''}
                        onClick={() => setPanelOut('metadata')}
                      >
                        Metadata
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
                      <div className="panel-preview-results">
                        <PreviewResults results={results} panelOut={panelOut} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ErrorBoundary>
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}
