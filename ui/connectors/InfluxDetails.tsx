import * as React from 'react';
import { DatabaseConnectorInfo, ServerInfo } from '../../shared/state';
import { FormGroup } from '../components/FormGroup';
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
      <FormGroup>
        <Host {...props} />
        <Username {...props} />
        <Password {...props} />
      </FormGroup>
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
