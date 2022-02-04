import {
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconChevronDown,
  IconChevronUp,
  IconDotsVertical,
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
import log from '../shared/log';
import { deepEquals } from '../shared/object';
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
import { UrlStateContext } from './urlState';

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
  panelId,
}: {
  panelOut: 'preview' | 'stdout' | 'shape' | 'metadata';
  results: PanelResultMeta & { metadata?: string };
  panelId: string;
}) {
  if (!results.lastRun) {
    return <React.Fragment>Panel not yet run.</React.Fragment>;
  }

  if (panelOut === 'metadata') {
    const metadata = [
      { name: 'Inferred Content-Type', value: results.contentType },
      { name: 'Size', value: humanSize(results.size) },
      {
        name: 'Estimated # of Elements',
        value:
          results.arrayCount === null
            ? 'Not an array'
            : results.arrayCount.toLocaleString(),
      },
      {
        name: 'Panel ID',
        value: `"${panelId}"`,
      },
    ];
    return (
      <Highlight language="javascript">
        {metadata.map((d) => `${d.name}: ${d.value}`).join('\n')}
      </Highlight>
    );
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

  let children = [];
  for (const c of parts) {
    if (!c) {
      continue;
    }

    if (c.startsWith('DM_setPanel(')) {
      children.push(<code>{c}</code>);
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
  const blank = panelUIDetails.factory();
  blank.id = panel.id;
  blank.name = panel.name;
  const isBlank = deepEquals(panel, blank);
  const [hidden, setHidden] = React.useState(false);

  const {
    state: { fullScreen, expanded },
    setState: setUrlState,
  } = React.useContext(UrlStateContext);

  const [details, setDetailsInternal] = React.useState(
    isBlank || expanded.includes(panel.id)
  );
  function setDetails(b: boolean) {
    setDetailsInternal(b);
    if (!b) {
      setUrlState({ expanded: expanded.filter((i) => i !== panel.id) });
    } else {
      setUrlState({ expanded: Array.from(new Set([...expanded, panel.id])) });
    }
  }

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
            <span title="Move Up">
              <Button
                icon
                disabled={panelIndex === 0}
                onClick={() => {
                  movePanel(panelIndex, panelIndex - 1);
                }}
              >
                <IconChevronUp />
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
                <IconChevronDown />
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

            <Input
              label="Name"
              className="panel-name"
              autoWidth
              placeholder={`Untitled panel #${panels.length + 1}`}
              onChange={(value: string) => {
                panel.name = value;
                updatePanel(panel);
              }}
              value={panel.name}
              invalid={nameIsDuplicate ? 'Names should be unique.' : ''}
            />

            <span title={details ? 'Hide Details' : 'Show Details'}>
              <Button
                data-testid="show-hide-panel"
                icon
                onClick={() => setDetails(!details)}
              >
                <IconDotsVertical />
              </Button>
            </span>

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
                        Took{' '}
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
                  {results.loading ? <IconPlayerPause /> : <IconPlayerPlay />}
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
                  onConfirm={() => removePanel(panelIndex)}
                  message="delete this panel"
                  action="Delete"
                  render={(confirm: () => void) => (
                    <Button icon onClick={confirm} type="outline">
                      <IconTrash />
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
                      panels={panels}
                      msg={results.exception.message}
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
                  {info}
                </div>
                {panelUIDetails.previewable && (
                  <div className="panel-out resize resize--left resize--horizontal">
                    <div className="panel-out-header">
                      <Button
                        className={panelOut === 'preview' ? 'selected' : ''}
                        onClick={() => setPanelOut('preview')}
                      >
                        Result
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
                        <PreviewResults
                          results={results}
                          panelOut={panelOut}
                          panelId={panel.id}
                        />
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
