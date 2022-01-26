import * as React from 'react';
import { DatabaseConnectorInfo, Encrypt, ServerInfo } from '../../shared/state';
import { FormGroup } from '../components/FormGroup';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { ServerPicker } from '../components/ServerPicker';
import { Host } from './Host';
import { Password } from './Password';
import { Username } from './Username';

export function ElasticsearchDetails(props: {
  connector: DatabaseConnectorInfo;
  updateConnector: (c: DatabaseConnectorInfo) => void;
  servers: Array<ServerInfo>;
}) {
  const { connector, updateConnector, servers } = props;

  return (
    <React.Fragment>
      <Host {...props} defaultValue="localhost:9200" />
      <Username {...props} />
      <Auth {...props} label="Base64 Encoded API Key" />
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
