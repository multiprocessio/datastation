import subMinutes from 'date-fns/subMinutes';
import * as React from 'react';
import { NoConnectorError } from '../../shared/errors';
import { ENDPOINTS } from '../../shared/rpc';
import {
  ConnectorInfo,
  TimeSeriesConnectorInfo,
  TimeSeriesConnectorInfoType,
  TimeSeriesFixedTimes,
  TimeSeriesPanelInfo,
  TimeSeriesRelativeTimes,
} from '../../shared/state';
import { title } from '../../shared/text';
import { evalRPC } from '../asyncRPC';
import { CodeEditor } from '../component-library/CodeEditor';
import { Datetime } from '../component-library/Datetime';
import { FormGroup } from '../component-library/FormGroup';
import { Radio } from '../component-library/Radio';
import { Select } from '../component-library/Select';
import { ServerPicker } from '../component-library/ServerPicker';
import { ProjectContext } from '../ProjectStore';
import { VENDORS, VENDOR_GROUPS } from '../tsconnectors';
import { PanelBodyProps, PanelDetailsProps, PanelUIDetails } from './types';

export async function evalTimeSeriesPanel(
  panel: TimeSeriesPanelInfo,
  _1: unknown,
  _2: unknown,
  connectors: Array<ConnectorInfo>
) {
  const connector = connectors.find(
    (c) => c.id === panel.timeseries.connectorId
  ) as TimeSeriesConnectorInfo;
  if (!connector) {
    throw new NoConnectorError();
  }

  return await evalRPC(ENDPOINTS.EVAL_TIME_SERIES, panel.id);
}

export function TimeSeriesPanelDetails({
  panel,
  updatePanel,
}: PanelDetailsProps<TimeSeriesPanelInfo>) {
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

  const setTab = (value: string) => {
    switch (value) {
      case 'relative':
        panel.timeseries.range = {
          rangeType: value,
          relative: 'last-hour',
        };
        break;
      case 'fixed':
        panel.timeseries.range = {
          rangeType: value,
          fixed: 'this-hour',
        };
        break;
      case 'absolute':
        panel.timeseries.range = {
          rangeType: value,
          begin: subMinutes(new Date(), 15),
          end: new Date(),
        };
        break;
    }
    updatePanel(panel);
  };

  const relativeOptions: Array<{
    label: string;
    options: Array<TimeSeriesRelativeTimes>;
  }> = [
    {
      label: 'Within day',
      options: [
        'last-5-minutes',
        'last-15-minutes',
        'last-30-minutes',
        'last-hour',
        'last-3-hours',
        'last-6-hours',
        'last-12-hours',
      ],
    },
    {
      label: 'Within month',
      options: ['last-day', 'last-3-days', 'last-week', 'last-2-weeks'],
    },
    {
      label: 'Within year',
      options: [
        'last-month',
        'last-2-months',
        'last-3-months',
        'last-6-months',
      ],
    },
    {
      label: 'Rest of time',
      options: ['last-year', 'last-2-years', 'all-time'],
    },
  ];

  const fixedOptions: Array<{
    label: string;
    options: Array<TimeSeriesFixedTimes>;
  }> = [
    {
      label: 'Within day',
      options: ['this-hour', 'previous-hour'],
    },
    {
      label: 'Within month',
      options: [
        'today',
        'yesterday',
        'week-to-date',
        'previous-week',
        'month-to-date',
      ],
    },
    {
      label: 'Rest of time',
      options: [
        'previous-month',
        'quarter-to-date',
        'previous-quarter',
        'year-to-date',
        'previous-year',
      ],
    },
  ];

  const { range } = panel.timeseries;

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
          {VENDOR_GROUPS.map((group) => (
            <optgroup
              label={group.label}
              key={group.label}
              children={group.vendors.map((v) => {
                const { name } = VENDORS[v];
                return <option value={v}>{name}</option>;
              })}
            />
          ))}
        </Select>
      </div>
      <div className="form-row">
        {vendorConnectors.length === 0 ? (
          <small>No connectors have been created for this vendor yet.</small>
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
        <div className="flex">
          <div className="form-row">
            <Radio
              vertical
              name="range-type"
              value={range.rangeType}
              onChange={setTab}
              options={[
                { value: 'relative', label: 'Relative' },
                { value: 'fixed', label: 'Fixed' },
                { value: 'absolute', label: 'Absolute' },
              ]}
            />
          </div>

          <div className="form-row flex flex--vertical items-flex-end">
            {range.rangeType === 'absolute' && (
              <React.Fragment>
                <div className="form-row">
                  <Datetime
                    label="Begin"
                    value={range.end}
                    onChange={(v) => {
                      range.begin = v;
                      updatePanel(panel);
                    }}
                  />
                </div>
                <div className="form-row">
                  <Datetime
                    label="End"
                    value={range.end}
                    onChange={(v) => {
                      range.end = v;
                      updatePanel(panel);
                    }}
                  />
                </div>
              </React.Fragment>
            )}
            {range.rangeType === 'relative' && (
              <React.Fragment>
                <Select
                  value={range.relative}
                  onChange={(id) => {
                    range.relative = id as TimeSeriesRelativeTimes;
                    updatePanel(panel);
                  }}
                  children={relativeOptions.map((group) => (
                    <optgroup label={group.label} key={group.label}>
                      {group.options.map((id) => (
                        <option value={id} key={id}>
                          {title(id)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                />
              </React.Fragment>
            )}

            {range.rangeType === 'fixed' && (
              <React.Fragment>
                <Select
                  onChange={(id) => {
                    range.fixed = id as TimeSeriesFixedTimes;
                    updatePanel(panel);
                  }}
                  value={range.fixed}
                  children={fixedOptions.map((group) => (
                    <optgroup label={group.label} key={group.label}>
                      {group.options.map((id) => (
                        <option value={id} key={id}>
                          {title(id)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                />
              </React.Fragment>
            )}
          </div>
        </div>
      </FormGroup>
    </React.Fragment>
  );
}

export function TimeSeriesPanelBody({
  updatePanel,
  panel,
  keyboardShortcuts,
}: PanelBodyProps<TimeSeriesPanelInfo>) {
  return (
    <CodeEditor
      id={panel.id}
      onKeyDown={keyboardShortcuts}
      value={panel.content}
      onChange={(value: string) => {
        panel.content = value;
        updatePanel(panel);
      }}
      language=""
      className="editor"
    />
  );
}

export const timeseriesPanel: PanelUIDetails<TimeSeriesPanelInfo> = {
  icon: 'events',
  eval: evalTimeSeriesPanel,
  id: 'timeseries',
  label: 'Time Series',
  details: TimeSeriesPanelDetails,
  body: TimeSeriesPanelBody,
  alwaysOpen: false,
  previewable: true,
  factory: () => new TimeSeriesPanelInfo(),
  info: null,
  hasStdout: false,
  killable: false,
};
