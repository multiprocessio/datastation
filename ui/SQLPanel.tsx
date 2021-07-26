import * as React from 'react';
import {
  ConnectorInfo,
  Proxy,
  ServerInfo,
  SQLConnectorInfo,
  SQLConnectorInfoType,
  SQLPanelInfo,
} from '../shared/state';
import { asyncRPC } from './asyncRPC';
import { Select } from './component-library/Select';
import { ProjectContext } from './ProjectStore';
import { ServerPicker } from './ServerPicker';

export async function evalSQLPanel(
  panel: SQLPanelInfo,
  indexIdMap: Record<number, string>,
  connectors: Array<ConnectorInfo>,
  servers: Array<ServerInfo>
) {
  const connector = connectors[
    +panel.sql.connectorIndex
  ] as Proxy<SQLConnectorInfo>;
  connector.server = servers.find(
    (s) => s.id === (panel.serverId || connector.serverId)
  );

  return await asyncRPC<
    Proxy<SQLConnectorInfo & { indexIdMap: Record<number, string> }>,
    string,
    { value: any; preview: string }
  >('evalSQL', panel.content, {
    ...connector,
    indexIdMap,
  });
}

export function SQLPanelDetails({
  panel,
  updatePanel,
}: {
  panel: SQLPanelInfo;
  updatePanel: (d: SQLPanelInfo) => void;
}) {
  const { connectors, servers } = React.useContext(ProjectContext);

  return (
    <React.Fragment>
      <div className="form-row">
        <Select
          label="Vendor"
          value={panel.sql.type}
          onChange={(value: string) => {
            panel.sql.type = value as SQLConnectorInfoType;
            updatePanel(panel);
          }}
        >
          <option value="postgres">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="sqlite">SQLite</option>
        </Select>
      </div>
      <div className="form-row">
        <Select
          label="Connector"
          value={panel.sql.connectorIndex.toString()}
          onChange={(connectorIndex: string) => {
            panel.sql.connectorIndex = +connectorIndex;
            updatePanel(panel);
          }}
        >
          {connectors
            .map((c: ConnectorInfo, index: number) => {
              if (
                c.type !== 'sql' ||
                (c as SQLConnectorInfo).sql.type !== panel.sql.type
              ) {
                return null;
              }

              return <option value={index}>{c.name}</option>;
            })
            .filter(Boolean)}
        </Select>
      </div>
      <ServerPicker
        servers={servers}
        serverId={panel.serverId}
        onChange={(serverId: string) => {
          panel.serverId = serverId;
          updatePanel(panel);
        }}
      />
    </React.Fragment>
  );
}
