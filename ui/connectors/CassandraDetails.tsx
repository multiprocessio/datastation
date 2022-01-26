import * as React from 'react';
import { DatabaseConnectorInfo, ServerInfo } from '../../shared/state';
import { ServerPicker } from '../components/ServerPicker';
import { Database } from './Database';
import { Host } from './Host';
import { Password } from './Password';
import { Username } from './Username';

export function CassandraDetails(props: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  servers: Array<ServerInfo>;
}) {
  const { servers, connector, updateConnector } = props;

  return (
    <React.Fragment>
      <Host connector={connector} updateConnector={updateConnector} />
      <Database
        label="Keyspace"
        connector={connector}
        updateConnector={updateConnector}
      />
      <Username {...props} />
      <Password {...props} />
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
