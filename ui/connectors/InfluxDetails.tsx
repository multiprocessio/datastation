import * as React from 'react';
import { DatabaseConnectorInfo, ServerInfo } from '../../shared/state';
import { ServerPicker } from '../components/ServerPicker';
import { Host } from './Host';
import { Password } from './Password';
import { Username } from './Username';

export function InfluxDetails(props: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  servers: Array<ServerInfo>;
}) {
  const { connector, updateConnector, servers } = props;

  return (
    <React.Fragment>
      <Host {...props} />
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
