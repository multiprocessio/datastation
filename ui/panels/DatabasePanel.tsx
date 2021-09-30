import * as React from 'react';
import { NoConnectorError } from '../../shared/errors';
import {
  ConnectorInfo,
  DatabaseConnectorInfo,
  DatabasePanelInfo,
  PanelResult,
  TimeSeriesRange as TimeSeriesRangeT,
} from '../../shared/state';
import { panelRPC } from '../asyncRPC';
import { CodeEditor } from '../components/CodeEditor';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { ServerPicker } from '../components/ServerPicker';
import { TimeSeriesRange } from '../components/TimeSeriesRange';
import { VENDOR_GROUPS } from '../connectors';
import { ProjectContext } from '../ProjectStore';
import { PanelBodyProps, PanelDetailsProps, PanelUIDetails } from './types';

export async function evalDatabasePanel(
  panel: DatabasePanelInfo,
  _1: Array<PanelResult>,
  _2: Array<string>,
  connectors: Array<ConnectorInfo>
) {
  const connector = connectors.find(
    (c) => c.id === panel.database.connectorId
  ) as DatabaseConnectorInfo;
  if (!connector) {
    throw new NoConnectorError();
  }

  return await panelRPC('eval', panel.id);
}

export function DatabasePanelDetails({
  panel,
  updatePanel,
}: PanelDetailsProps<DatabasePanelInfo>) {
  const { connectors, servers } = React.useContext(ProjectContext);

  React.useEffect(() => {
    if (!connectors.length && panel.database.connectorId) {
      panel.database.connectorId = '';
    }

    const connector = connectors.find(
      (c) => c.id === panel.database.connectorId
    ) as DatabaseConnectorInfo;
    if (!connector) {
      return;
    }

    if (connector.database.type === 'influx' && !panel.database.range.field) {
      panel.database.range.field = 'time';
    }
  });

  const vendorsWithConnectors = VENDOR_GROUPS.map((group) => {
    return {
      label: group.group,
      options: group.vendors
        .map((id) =>
          connectors.filter(
            (c) =>
              c.type === 'database' &&
              (c as DatabaseConnectorInfo).database.type === id
          )
        )
        .flat()
        .sort((a, b) => (a.name < b.name ? 1 : -1)),
    };
  }).filter((g) => g.options.length);

  const connectorNotRemote =
    connectors.length &&
    !(
      connectors.find((c) => c.id === panel.database.connectorId) ||
      new DatabaseConnectorInfo()
    ).serverId;

  return (
    <React.Fragment>
      <div className="form-row">
        {connectors.length === 0 ? (
          <small>Create a connector on the left to get started.</small>
        ) : (
          <Select
            label="Connector"
            value={panel.database.connectorId}
            onChange={(connectorId: string) => {
              panel.database.connectorId = connectorId;
              updatePanel(panel);
            }}
          >
            {vendorsWithConnectors.map((g) => (
              <optgroup label={g.label} key={g.label}>
                {g.options.map((o) => (
                  <option key={o.name} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        )}
      </div>
      {panel.database.type === 'elasticsearch' && (
        <Input
          label="Indexes"
          placeholder="journalbeat-*,logstash-*"
          value={panel.database.table}
          onChange={(i: string) => {
            panel.database.table = i;
            updatePanel(panel);
          }}
        />
      )}
      {!['cassandra', 'presto'].includes(panel.database.type) && (
        <TimeSeriesRange
          range={panel.database.range}
          updateRange={(r: TimeSeriesRangeT) => {
            panel.database.range = r;
            updatePanel(panel);
          }}
        />
      )}
      {panel.database.type === 'influx' && (
        <Input
          label="Step (seconds)"
          type="number"
          value={panel.database.step}
          onChange={(s: string) => {
            panel.database.step = +s;
            updatePanel(panel);
          }}
        />
      )}
      {connectorNotRemote && (
        <ServerPicker
          servers={servers}
          serverId={panel.serverId}
          onChange={(serverId: string) => {
            panel.serverId = serverId;
            updatePanel(panel);
          }}
        />
      )}
    </React.Fragment>
  );
}

export function DatabasePanelBody({
  updatePanel,
  panel,
  keyboardShortcuts,
}: PanelBodyProps<DatabasePanelInfo>) {
  return (
    <CodeEditor
      id={panel.id}
      onKeyDown={keyboardShortcuts}
      value={panel.content}
      onChange={(value: string) => {
        panel.content = value;
        updatePanel(panel);
      }}
      language="sql"
      className="editor"
    />
  );
}

export const databasePanel: PanelUIDetails<DatabasePanelInfo> = {
  icon: 'table_rows',
  eval: evalDatabasePanel,
  id: 'database',
  label: 'Database',
  details: DatabasePanelDetails,
  body: DatabasePanelBody,
  alwaysOpen: false,
  previewable: true,
  factory: () => new DatabasePanelInfo(),
  hasStdout: false,
  info: null,
  killable: false,
};
