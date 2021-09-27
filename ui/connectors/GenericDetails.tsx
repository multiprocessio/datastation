import * as React from 'react';
import { ServerInfo, SQLConnectorInfo } from '../../shared/state';
import { ServerPicker } from '../components/ServerPicker';
import { Database } from './Database';
import { Host } from './Host';
import { Password } from './Password';
import { Username } from './Username';

export interface GenericDetailsProps {
  connector: SQLConnectorInfo;
  updateConnector: (c: SQLConnectorInfo) => void;
  servers: Array<ServerInfo>;
  skipDatabase?: boolean;
}

export function GenericDetails(props: GenericDetailsProps) {
  const { servers, connector, updateConnector } = props;
  return (
    <React.Fragment>
      <Host {...props} />
      {props.skipDatabase ? null : <Database {...props} />}
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
