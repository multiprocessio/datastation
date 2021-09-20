import * as React from 'react';
import { Shape } from 'shape';
import { SQLEvalBody } from '../shared/rpc';
import {
  ConnectorInfo,
  PanelResult,
  ServerInfo,
  SQLConnectorInfo,
  SQLConnectorInfoType,
  SQLPanelInfo,
} from '../shared/state';
import { asyncRPC } from './asyncRPC';
import { Select } from './component-library/Select';
import { ProjectContext } from './ProjectStore';
import { ServerPicker } from './ServerPicker';
import { VENDORS } from './sqlconnectors';

export async function evalSQLPanel(
  panel: SQLPanelInfo,
  indexIdMap: Array<string>,
  connectors: Array<ConnectorInfo>,
  _: Array<ServerInfo>,
  indexShapeMap: Array<Shape>
) {
  const connector = connectors.find(
    (c) => c.id === panel.sql.connectorId
  ) as SQLConnectorInfo;
  return await asyncRPC<SQLEvalBody, string, PanelResult>(
    'evalSQL',
    panel.content,
    {
      ...panel,
      serverId: panel.serverId || connector.serverId,
      indexShapeMap,
      indexIdMap,
    }
  );
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
        <Select
          label="Connector"
          value={panel.sql.connectorId}
          onChange={(connectorId: string) => {
            panel.sql.connectorId = connectorId;
            updatePanel(panel);
          }}
        >
          {connectors
            .map((c: ConnectorInfo) => {
              if (
                c.type !== 'sql' ||
                (c as SQLConnectorInfo).sql.type !== panel.sql.type
              ) {
                return null;
              }

              return (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              );
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
