import formatDistanceStrict from 'date-fns/formatDistanceStrict';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import circularSafeStringify from 'json-stringify-safe';
import * as CSV from 'papaparse';
import * as React from 'react';
import { toString } from 'shape';
import { MODE, MODE_FEATURES } from '../shared/constants';
import log from '../shared/log';
import {
  PanelInfo,
  PanelInfoType,
  PanelResult,
  PanelResultMeta,
} from '../shared/state';
import { humanSize } from '../shared/text';
import { panelRPC } from './asyncRPC';
import { Alert } from './components/Alert';
import { Button } from './components/Button';
import { Confirm } from './components/Confirm';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Highlight } from './components/Highlight';
import { Input } from './components/Input';
import { Select } from './components/Select';
import { PanelPlayWarning } from './errors';
import { PANEL_GROUPS, PANEL_UI_DETAILS } from './panels';

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
      log.error('Invalid context ref');
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
    const res = await panelRPC('fetchResults', panel.id);
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
          'Number of Elements':
            results.arrayCount === null ? 'Not an array' : results.arrayCount,
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
  // Fall back to empty dict in case panel.type names ever change
  const panelUIDetails =
    PANEL_UI_DETAILS[panel.type] || PANEL_UI_DETAILS.literal;
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

  const killable = results.loading && MODE_FEATURES.killProcess;
  function killProcess() {
    return panelRPC('killProcess', panel.id);
  }

  return (
    <div
      id={`panel-${panelIndex}`}
      className={`panel ${hidden ? 'panel--hidden' : ''} ${
        panelUIDetails.body === null && !results.exception ? 'panel--empty' : ''
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
                (panel as any)[panelType] = newPanel[panelType];
                panel.type = panelType;
                updatePanel(panel);
              }}
            >
              {PANEL_GROUPS.map((group) => (
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
            </Select>

            <span className="material-icons">{panelUIDetails.icon}</span>

            <Input
              className="panel-name"
              autoWidth
              placeholder={`Untitled panel #${panelIndex}`}
              onChange={(value: string) => {
                panel.name = value;
                updatePanel(panel);
              }}
              value={panel.name}
            />

            {!panelUIDetails.alwaysOpen && (
              <span title={details ? 'Hide Details' : 'Show Details'}>
                <Button
                  data-testid="show-hide-panel"
                  icon
                  onClick={() => setDetails(!details)}
                >
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
                  results.loading
                    ? killable
                      ? 'Cancel'
                      : 'Running'
                    : 'Evaluate Panel (Ctrl-Enter)'
                }
              >
                <Button
                  icon
                  onClick={() =>
                    killable ? killProcess() : reevalPanel(panel.id)
                  }
                  type="primary"
                >
                  {results.loading ? 'close' : 'play_circle'}
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
                      updatePanel={updatePanel}
                    />
                  )}
                  {results.exception instanceof PanelPlayWarning ? (
                    <PanelPlayWarningWithLinks
                      msg={results.exception.message}
                      indexNameMap={panels.map(({ name }) => name)}
                    />
                  ) : (
                    results.exception && (
                      <Alert type="error">
                        <div>Error evaluating panel:</div>
                        <pre>
                          <code>
                            {results.exception.stack ||
                              results.exception.message ||
                              String(results.exception)}
                          </code>
                        </pre>
                      </Alert>
                    )
                  )}
                  {panelUIDetails.info && (
                    <Alert type="info">
                      <panelUIDetails.info panel={panel} />
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
                      {panelUIDetails.hasStdout && (
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
