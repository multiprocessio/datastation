import * as React from 'react';
import { Shape } from 'shape';
import { NoConnectorError } from '../shared/errors';
import { TimeSeriesEvalBody } from '../shared/rpc';
import {
  ConnectorInfo,
  PanelResult,
  ServerInfo,
  TimeSeriesConnectorInfo,
  TimeSeriesConnectorInfoType,
  TimeSeriesPanelInfo,
} from '../shared/state';
import { asyncRPC } from './asyncRPC';
import { Select } from './component-library/Select';
import { ProjectContext } from './ProjectStore';
import { ServerPicker } from './ServerPicker';
import { VENDORS } from './timeseriesconnectors';

export async function evalTimeSeriesPanel(
  panel: TimeSeriesPanelInfo,
  indexIdMap: Array<string>,
  connectors: Array<ConnectorInfo>,
  _: Array<ServerInfo>,
  indexShapeMap: Array<Shape>
) {
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
}: {
  panel: TimeSeriesPanelInfo;
  updatePanel: (d: TimeSeriesPanelInfo) => void;
}) {
  const { connectors, servers } = React.useContext(ProjectContext);

  const vendorConnectors = connectors
    .map((c: ConnectorInfo) => {
      if (
        c.type !== 'timeseries' ||
        (c as TimeSeriesConnectorInfo).timeseries.type !== panel.timeseries.type
      ) {
        return null;
      }

      return c;
    })
    .filter(Boolean);

  React.useEffect(() => {
    if (!vendorConnectors.length && panel.timeseries.connectorId) {
      panel.timeseries.connectorId = '';
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
          value={panel.timeseries.type}
          onChange={(value: string) => {
            panel.timeseries.type = value as TimeSeriesConnectorInfoType;
            updatePanel(panel);
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
            value={panel.timeseries.connectorId}
            onChange={(connectorId: string) => {
              panel.timeseries.connectorId = connectorId;
              updatePanel(panel);
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
        serverId={panel.serverId}
        onChange={(serverId: string) => {
          panel.serverId = serverId;
          updatePanel(panel);
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
                  panel.timeseries.range.begin = v;
                  updatePanel(panel);
                }}
              />
              <Datetime
                label="End"
                onChange={(v) => {
                  panel.timeseries.range.end = v;
                  updatePanel(panel);
                }}
              />
            </div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div className="tab-name">Relative</div>
            <Select
              onChange={() => {
                panel.timeseries.range.begin = new Date() - diff;
                panel.timeseries.range.end = new Date();
                updatePanel(panel);
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
      <Editor label="Query" />
    </React.Fragment>
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
};
