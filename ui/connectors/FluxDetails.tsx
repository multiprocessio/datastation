import * as React from 'react';
import { DatabaseConnectorInfo, ServerInfo } from '../../shared/state';
import { ServerPicker } from '../components/ServerPicker';
import { ApiKey } from './ApiKey';
import { Database } from './Database';
import { Host } from './Host';

export function FluxDetails(props: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  servers: Array<ServerInfo>;
}) {
  const { connector, updateConnector, servers } = props;

  return (
    <React.Fragment>
      <Host {...props} />
      <Database label="Organization" {...props} />
      <ApiKey {...props} />
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
