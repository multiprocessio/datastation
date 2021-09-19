import * as React from 'react';
import { ServerInfo, SQLConnectorInfo } from '../../shared/state';
import { ServerPicker } from '../ServerPicker';
import { Database } from './Database';
import { Host } from './Host';
import { Password } from './Password';
import { Username } from './Username';

export function GenericDetails(props: {
  connector: SQLConnectorInfo;
  updateConnector: (c: SQLConnectorInfo) => void;
  servers: Array<ServerInfo>;
}) {
  const { servers, connector, updateConnector } = props;
  return (
    <React.Fragment>
      <Host {...props} />
      <Database {...props} />
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
