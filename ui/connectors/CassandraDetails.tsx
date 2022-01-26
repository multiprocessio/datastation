import * as React from 'react';
import { DatabaseConnectorInfo, ServerInfo } from '../../shared/state';
import { ServerPicker } from '../components/ServerPicker';
import { Database } from './Database';
import { Host } from './Host';
import { Auth } from './Auth';

export function GenericDetails(props: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  servers: Array<ServerInfo>;
}) {
  const { servers, connector, updateConnector } = props;

  return (
    <React.Fragment>
      <Host connector={connector} updateConnector={updateConnector} />
      <Database label="Keyspace" connector={connector} updateConnector={updateConnector} />
      <Auth connector={connector} updateConnector={updateConnector} />
      <ServerPicker
        servers={servers}
        serverId={connector.serverId}
        onChange={(serverId: string) => {
          connector.serverId = serverId;
          updateConnector(connector);
        }}
      />
    </React.Fragment>
  );
}
