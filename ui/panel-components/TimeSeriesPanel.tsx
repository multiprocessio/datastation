import * as React from 'react';
import { NoConnectorError } from '../../shared/errors';
import { TimeSeriesEvalBody } from '../../shared/rpc';
import {
  ConnectorInfo,
  PanelResult,
  ServerInfo,
  TimeSeriesConnectorInfo,
  TimeSeriesConnectorInfoType,
  TimeSeriesPanelInfo,
} from '../../shared/state';
import { asyncRPC } from '../asyncRPC';
import { FormGroup } from '../component-library/FormGroup';
import { Select } from '../component-library/Select';
import { ServerPicker } from '../component-library/ServerPicker';
import { ProjectContext } from '../ProjectStore';
import { VENDORS } from '../timeseriesconnectors';
import {
  guardPanel,
  PanelBodyProps,
  PanelDetailsProps,
  PanelUIDetails,
} from './types';

export async function evalTimeSeriesPanel(
  panel: TimeSeriesPanelInfo,
  panelResults: Array<PanelResult>,
  indexIdMap: Array<string>,
  connectors: Array<ConnectorInfo>,
  _1: Array<ServerInfo>
) {
  const indexShapeMap = panelResults.map((r) => r.shape);

  const connector = connectors.find(
    (c) => c.id === panel.timeseries.connectorId
  ) as TimeSeriesConnectorInfo;
  if (!connector) {
    throw new NoConnectorError();
  }

  return await asyncRPC<TimeSeriesEvalBody, string, PanelResult>(
    'evalTimeSeries',
    panel.content,
    {
      ...panel,
      serverId: panel.serverId || connector.serverId,
      indexShapeMap,
      indexIdMap,
    }
  );
}

export function TimeSeriesPanelDetails({
  panel,
  updatePanel,
}: PanelDetailsProps) {
  const tsp = guardPanel<TimeSeriesPanelInfo>(panel, 'timeseries');
  const { connectors, servers } = React.useContext(ProjectContext);

  const vendorConnectors = connectors
    .map((c: ConnectorInfo) => {
      if (
        c.type !== 'timeseries' ||
        (c as TimeSeriesConnectorInfo).timeseries.type !== tsp.timeseries.type
      ) {
        return null;
      }

      return c;
    })
    .filter(Boolean);

  React.useEffect(() => {
    if (!vendorConnectors.length && tsp.timeseries.connectorId) {
      tsp.timeseries.connectorId = '';
    }
  });

  const relativeOptions = [
    {
      label: 'Within day',
      options: [
        { label: 'Last 5 minutes', minutes: 5 },
        { label: 'Last 15 minutes', minutes: 15 },
        { label: 'Last 30 minutes', minutes: 30 },
        { label: 'Last hour', minutes: 60 },
        { label: 'Last 3 hours', minutes: 180 },
        { label: 'Last 6 hours', minutes: 360 },
        { label: 'Last 12 hours', minutes: 720 },
      ],
    },
    {
      label: 'Within month',
      options: [
        { label: 'Last day', minutes: 60 * 24 },
        { label: 'Last 3 days', minutes: 60 * 24 * 3 },
        { label: 'Last week', minutes: 60 * 24 * 7 },
        { label: 'Last 2 weeks', minutes: 60 * 24 * 14 },
        { label: 'Last 30 days', minutes: 60 * 24 * 7 * 30 },
      ],
    },
    {
      label: 'Within year',
      options: [
        { label: 'Last 2 months', minutes: 60 * 24 * 7 * 60 },
        { label: 'Last 3 months', minutes: 60 * 24 * 7 * 90 },
        { label: 'Last 6 months', minutes: 60 * 24 * 7 * 180 },
      ],
    },
    {
      label: 'Rest of time',
      options: [
        { label: 'Last year', minutes: 60 * 24 * 7 * 365 },
        { label: 'Last 2 years', minutes: 60 * 24 * 7 * 365 * 2 },
        { label: 'All time', minutes: 60 * 24 * 7 * 365 * 100 },
      ],
    },
  ];

  return (
    <React.Fragment>
      <div className="form-row">
        <Select
          label="Vendor"
          value={tsp.timeseries.type}
          onChange={(value: string) => {
            tsp.timeseries.type = value as TimeSeriesConnectorInfoType;
            updatePanel(tsp);
          }}
        >
          {VENDORS.map((group) => (
            <optgroup
              label={group.group}
              children={group.vendors.map((v) => (
                <option value={v.id}>{v.name}</option>
              ))}
            />
          ))}
        </Select>
      </div>
      <div className="form-row">
        {vendorConnectors.length === 0 ? (
          'No connectors have been created for this vendor yet.'
        ) : (
          <Select
            label="Connector"
            value={tsp.timeseries.connectorId}
            onChange={(connectorId: string) => {
              tsp.timeseries.connectorId = connectorId;
              updatePanel(tsp);
            }}
          >
            {vendorConnectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      <ServerPicker
        servers={servers}
        serverId={tsp.serverId}
        onChange={(serverId: string) => {
          tsp.serverId = serverId;
          updatePanel(tsp);
        }}
      />
      <FormGroup label="Time Range">
        {tab === 'absolute' ? (
          <React.Fragment>
            <div className="tab-name">Absolute</div>
            <div className="flex">
              <Datetime
                label="Begin"
                onChange={(v) => {
                  tsp.timeseries.range.begin = v;
                  updatePanel(tsp);
                }}
              />
              <Datetime
                label="End"
                onChange={(v) => {
                  tsp.timeseries.range.end = v;
                  updatePanel(tsp);
                }}
              />
            </div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div className="tab-name">Relative</div>
            <Select
              onChange={() => {
                tsp.timeseries.range.begin = new Date() - diff;
                tsp.timeseries.range.end = new Date();
                updatePanel(tsp);
              }}
              children={relativeOptions.map((group) => (
                <optgroup label={group.label}>
                  {group.options.map(({ label, diff }) => (
                    <option>{label}</option>
                  ))}
                </optgroup>
              ))}
            />
          </React.Fragment>
        )}
      </FormGroup>
    </React.Fragment>
  );
}

export function TimeSeriesPanelBody({
  updatePanel,
  panel,
  keyboardShortcuts,
}: PanelBodyProps) {
  const sp = guardPanel<TimeSeriesPanelInfo>(panel, 'sql');

  return (
    <CodeEditor
      id={sp.id}
      onKeyDown={keyboardShortcuts}
      value={sp.content}
      onChange={(value: string) => {
        sp.content = value;
        updatePanel(sp);
      }}
      language=""
      className="editor"
    />
  );
}

export const timeseriesPanel: PanelUIDetails = {
  icon: 'calender_view_week',
  eval: evalTimeSeriesPanel,
  id: 'timeseries',
  label: 'Time Series',
  details: TimeSeriesPanelDetails,
  body: null,
  alwaysOpen: false,
  previewable: true,
  factory: () => new TimeSeriesPanelInfo(),
  info: null,
  hasStdout: false,
  killable: false,
};
