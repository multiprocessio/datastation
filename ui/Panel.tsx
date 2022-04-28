import {
  IconAlertTriangle,
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconChevronDown,
  IconChevronUp,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconPlayerPause,
  IconPlayerPlay,
  IconTrash,
} from '@tabler/icons';
import formatDistanceStrict from 'date-fns/formatDistanceStrict';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import circularSafeStringify from 'json-stringify-safe';
import * as CSV from 'papaparse';
import * as React from 'react';
import { toString } from 'shape';
import { MODE, MODE_FEATURES } from '../shared/constants';
import { EVAL_ERRORS } from '../shared/errors';
import log from '../shared/log';
import { PanelInfo, PanelResult } from '../shared/state';
import { humanSize } from '../shared/text';
import { panelRPC } from './asyncRPC';
import { Alert } from './components/Alert';
import { Button } from './components/Button';
import { Confirm } from './components/Confirm';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Highlight } from './components/Highlight';
import { Input } from './components/Input';
import { PANEL_UI_DETAILS } from './panels';
import { UrlStateContext } from './urlState';

export const VISUAL_PANELS = ['graph', 'table'];

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
  panelOut: 'preview' | 'stdout' | 'shape';
  results: PanelResult;
}) {
  if (!results.lastRun) {
    return <React.Fragment>Panel not yet run.</React.Fragment>;
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

export function getNameOrIdFromNameOrIdOrIndex(
  panels: Array<PanelInfo>,
  id: string
): null | { name: string; id: string } {
  for (const panel of panels) {
    if (panel.id === id) {
      return { name: panel.name, id: panel.id };
    }
  }

  for (const panel of panels) {
    if (panel.name === id) {
      return { name: panel.name, id: panel.id };
    }
  }

  if (!isNaN(+id) && panels[+id]) {
    return { name: panels[+id].name, id: panels[+id].id };
  }

  return null;
}

export function PanelPlayWarningWithLinks({
  panels,
  msg,
}: {
  panels: Array<PanelInfo>;
  msg: string;
}) {
  const parts = msg.split(/(\[(?:[^\]\\]|\\.)*\])|(DM_setPanel\([$a-zA-Z]*\))/);

  const children = [];
  for (const c of parts) {
    if (!c) {
      continue;
    }

    if (c.startsWith('DM_setPanel(')) {
      children.push(<code>{c}</code>);
      continue;
    }

    if (!(c[0] === '[' && c[c.length - 1] === ']')) {
      children.push(c);
      continue;
    }

    // Drop the surrounding [ and ]
    const id = c.substring(1, c.length - 1);
    const panel = getNameOrIdFromNameOrIdOrIndex(panels, id);
    if (!panel) {
      log.info('Failed to resolve panel ' + c);
      return (
        <Alert type="warning">
          Unable to resolve panel <strong>{c}</strong>. Did you enter a valid
          panel name or index?
        </Alert>
      );
    }

    children.push(<a href={'#panel-' + panel.id}>{panel.name}</a>);
  }

  return <Alert type="warning" children={children} />;
}

function PanelError({ panels, e }: { panels: Array<PanelInfo>; e: Error }) {
  if (!e) {
    return null;
  }

  // ui eval emits PanelPlayWarning directly
  if (EVAL_ERRORS.map((cls) => new (cls as any)().name).includes(e.name)) {
    return <PanelPlayWarningWithLinks panels={panels} msg={e.message} />;
  }

  return (
    <Alert type="error">
      <div>Error evaluating panel:</div>
      <pre>
        <code>
          {e.stack ||
            e.message ||
            (String(e) === '[object Object]' /* this might be Chrome specific */
              ? circularSafeStringify(e, null, 2)
              : String(e))}
        </code>
      </pre>
    </Alert>
  );
}

export function Panel({
  panel,
  updatePanel,
  reevalPanel,
  panelIndex,
  removePanel,
  panels,
}: {
  panel: PanelInfo;
  updatePanel: (d: PanelInfo, position?: number) => void;
  panelResults: Array<PanelResult>;
  reevalPanel: (id: string) => Promise<Array<PanelInfo>>;
  panelIndex: number;
  removePanel: (id: string) => void;
  panels: Array<PanelInfo>;
}) {
  const [hidden, setHidden] = React.useState(false);
  const panelUIDetails =
    PANEL_UI_DETAILS[panel.type] || PANEL_UI_DETAILS.literal;

  const {
    state: { fullScreen, expanded },
    setState: setUrlState,
  } = React.useContext(UrlStateContext);

  const [details, setDetailsInternal] = React.useState(
    expanded.includes(panel.id)
  );
  const setDetails = React.useCallback(
    (b: boolean) => {
      setDetailsInternal(b);
      if (!b) {
        setUrlState({ expanded: expanded.filter((i) => i !== panel.id) });
      } else {
        setUrlState({ expanded: Array.from(new Set([...expanded, panel.id])) });
      }
    },
    [setUrlState, expanded, setDetailsInternal, panel.id]
  );
  React.useEffect(() => {
    // Don't show table details because they can be pretty big
    if (!panel.defaultModified && !details && panel.type !== 'table') {
      setDetails(true);
    }
  }, [panel.defaultModified, details, setDetails, panel.type]);

  const [panelOut, setPanelOut] = React.useState<
    'preview' | 'stdout' | 'shape'
  >('preview');
  const results = panel.resultMeta || new PanelResult();

  const [loading, setLoading] = React.useState(results.loading);
  // Sync when props change
  React.useEffect(() => {
    setLoading(results.loading);
  }, [results.loading]);

  const [error, setError] = React.useState(results.exception);
  // Sync when props change
  React.useEffect(() => {
    setError(results.exception);
  }, [results.exception]);

  async function evalThis() {
    if (killable) {
      await killProcess();

      // Only don't reeval if we think it's already not running.  //
      // This allows the UI to kill any background running process that
      // might have started on a different page or something like that.
      if (loading) {
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      await reevalPanel(panel.id);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  const panelRef = React.useRef(null);
  async function keyboardShortcuts(e: React.KeyboardEvent) {
    if (
      !panelRef.current &&
      panelRef.current !== document.activeElement &&
      !panelRef.current.contains(document.activeElement)
    ) {
      return;
    }

    if (e.ctrlKey && e.code === 'Enter') {
      if (e.preventDefault) {
        e.preventDefault();
      }

      evalThis();
    }
  }

  const killable = loading && MODE_FEATURES.killProcess;
  function killProcess() {
    return panelRPC('killProcess', panel.id);
  }

  const nameIsDuplicate = panels
    .filter((p) => p.id !== panel.id)
    .map((p) => p.name)
    .includes(panel.name);

  let info = null;
  if (panelUIDetails.info) {
    // Although this is a render call, the `return null` within here
    // gets transformed unintelligibly if you do
    // <panelUIDetails.info panel={panel} />. So do a normal JavaScript function call instead.
    info = panelUIDetails.info({ panel });
    if (info) {
      info = <Alert type="info">{info}</Alert>;
    }
  }

  return (
    <div
      id={`panel-${panel.id}`}
      className={`panel ${fullScreen === panel.id ? 'panel--fullscreen' : ''} ${
        hidden ? 'panel--hidden' : ''
      } ${
        (panelUIDetails.body === null ||
          (panelUIDetails.hideBody && panelUIDetails.hideBody(panel))) &&
        !error
          ? 'panel--empty'
          : ''
      } ${loading ? 'panel--loading' : ''}`}
      tabIndex={1001}
      ref={panelRef}
      onKeyDown={keyboardShortcuts}
    >
      <ErrorBoundary>
        <div className="panel-head">
          <div
            onDoubleClick={(e: React.MouseEvent) => {
              // Need to make sure if the user clicks into the name input they don't trigger the fullscreen toggle.
              const textNodeType = 3;
              const target = e.target as HTMLElement;
              if (
                target.tagName.toLowerCase() === 'input' ||
                target.nodeType === textNodeType
              ) {
                return;
              }

              setUrlState({
                fullScreen: fullScreen === panel.id ? null : panel.id,
              });
            }}
            className={`panel-header ${
              details ? 'panel-header--open' : ''
            } vertical-align-center`}
          >
            <span title="Move Up">
              <Button
                icon
                disabled={panelIndex === 0}
                onClick={() => updatePanel(panel, panelIndex - 1)}
              >
                <IconChevronUp />
              </Button>
            </span>
            <span title="Move Down">
              <Button
                icon
                disabled={panelIndex === panels.length - 1}
                onClick={() => updatePanel(panel, panelIndex + 1)}
              >
                <IconChevronDown />
              </Button>
            </span>

            <label className="ml-2 text-muted" title={panel.id}>
              {PANEL_UI_DETAILS[panel.type].label}
            </label>

            <Input
              label="Name"
              className="panel-name ml-1"
              placeholder={`Untitled panel #${panels.length + 1}`}
              onChange={(value: string) => {
                panel.name = value;
                updatePanel(panel);
              }}
              value={panel.name}
              invalid={nameIsDuplicate ? 'Names should be unique.' : ''}
            />

            <span
              className="ml-2"
              title={details ? 'Less Options' : 'More Options'}
            >
              <Button
                data-testid="show-hide-panel"
                type="outline"
                icon
                onClick={() => setDetails(!details)}
              >
                {details ? 'Less Options' : 'More Options'}
              </Button>
            </span>

            <span className="panel-controls vertical-align-center flex-right">
              <span className="text-muted">
                {loading ? (
                  'Running...'
                ) : results.lastRun ? (
                  <>
                    <span className={error ? 'text-failure' : 'text-success'}>
                      {error ? 'Failed' : 'Succeeded'}
                    </span>{' '}
                    {results.lastRun ? (
                      <>
                        {formatDistanceToNow(results.lastRun, {
                          addSuffix: true,
                        })}
                        <div>
                          <small>
                            Took{' '}
                            {formatDistanceStrict(
                              results.lastRun.valueOf() -
                                (results.elapsed || 0),
                              results.lastRun.valueOf()
                            )}
                          </small>
                        </div>
                      </>
                    ) : null}
                  </>
                ) : (
                  'Run to apply changes'
                )}
              </span>
              <span
                title={
                  loading
                    ? killable
                      ? 'Cancel'
                      : 'Running'
                    : 'Evaluate Panel (Ctrl-Enter)'
                }
              >
                <Button icon onClick={evalThis} type="primary">
                  {loading ? <IconPlayerPause /> : <IconPlayerPlay />}
                </Button>
              </span>
              <span title="Full screen mode">
                <Button
                  icon
                  onClick={() =>
                    setUrlState({
                      fullScreen: fullScreen === panel.id ? null : panel.id,
                    })
                  }
                  disabled={hidden}
                >
                  {fullScreen === panel.id ? (
                    <IconArrowsDiagonalMinimize2 />
                  ) : (
                    <IconArrowsDiagonal />
                  )}
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
                  <IconDownload />
                </Button>
              </span>
              <span title="Hide Panel">
                <Button icon onClick={() => setHidden(!hidden)}>
                  {hidden ? <IconEye /> : <IconEyeOff />}
                </Button>
              </span>
              <span title="Delete Panel">
                <Confirm
                  onConfirm={() => removePanel(panel.id)}
                  message="delete this panel"
                  action="Delete"
                  render={(confirm: () => void) => (
                    <Button icon onClick={confirm}>
                      <IconTrash />
                    </Button>
                  )}
                />
              </span>
            </span>
          </div>
          {details && (
            <div className="panel-details form">
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
                  {panelUIDetails.body &&
                    (panelUIDetails.hideBody
                      ? !panelUIDetails.hideBody(panel)
                      : true) && (
                      <panelUIDetails.body
                        panel={panel}
                        keyboardShortcuts={keyboardShortcuts}
                        panels={panels}
                        updatePanel={updatePanel}
                      />
                    )}
                  {
                    /* Visual panels get run automatically. Don't show the Cancelled alert since this will happen all the time. */ VISUAL_PANELS.includes(
                      panel.type
                    ) && error?.name === 'Cancelled' ? null : (
                      <PanelError panels={panels} e={error} />
                    )
                  }
                  {info}
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
                        Schema
                      </Button>
                      {panelUIDetails.hasStdout && (
                        <Button
                          className={panelOut === 'stdout' ? 'selected' : ''}
                          onClick={() => setPanelOut('stdout')}
                        >
                          Stdout/Stderr
                          <span className="ml-1">
                            {results.stdout ? <IconAlertTriangle /> : null}
                          </span>
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
              <div className="status-bar">
                {!panel.resultMeta ? (
                  'Panel not yet run.'
                ) : loading ? (
                  'Running...'
                ) : (
                  <>
                    <span className="status-bar-element">
                      <label>{panel.id}</label>
                    </span>
                    <span className="status-bar-element">
                      <label>Rows (Estimate)</label>{' '}
                      {!panel.resultMeta.arrayCount &&
                      String(panel.resultMeta.arrayCount) !== '0'
                        ? 'Not an array'
                        : parseInt(
                            String(panel.resultMeta.arrayCount)
                          ).toLocaleString()}
                    </span>
                    <span className="status-bar-element">
                      <label>Size</label> {humanSize(panel.resultMeta.size)}
                    </span>
                    <span className="status-bar-element">
                      <label>Content-Type (Inferred)</label>{' '}
                      {panel.resultMeta.contentType}
                    </span>
                  </>
                )}
              </div>
            </ErrorBoundary>
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}
