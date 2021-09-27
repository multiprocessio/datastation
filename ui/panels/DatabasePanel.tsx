import * as React from 'react';
import { NoConnectorError } from '../../shared/errors';
import {
  ConnectorInfo,
  PanelResult,
  DatabasePanelInfo,
  DatabaseConnectorInfo,
  TimeSeriesRange as TimeSeriesRangeT,
} from '../../shared/state';
import { panelRPC } from '../asyncRPC';
import { CodeEditor } from '../components/CodeEditor';
import { Select } from '../components/Select';
import { ServerPicker } from '../components/ServerPicker';
import { ProjectContext } from '../ProjectStore';
import { VENDORS } from '../connectors';
import { TimeSeriesRange } from '../components/TimeSeriesRange';
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
  });

  const vendorsWithConnectors = VENDORS.map(group => {
    return {
      label: group.group,
      options: group.vendors.map(({ id }) => connectors.filter(c => c.type === id)).flat().sort((a, b) => a.name < b.name ? 1 : -1),
    };
  }).filter(g => g.options.length);

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
          {vendorsWithConnectors.map(g => {
            <optgroup label={g.label} key={g.label}>
              {g.options.map(o => <option key={o.name} value={o.id}>{o.name}</option>)}
            </optgroup>
            })}
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
      <TimeSeriesRange
        range={panel.database.range}
        updateRange={(r: TimeSeriesRangeT) => {
          panel.database.range = r;
          updatePanel(panel);
        }}
      />
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

export const sqlPanel: PanelUIDetails<DatabasePanelInfo> = {
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
